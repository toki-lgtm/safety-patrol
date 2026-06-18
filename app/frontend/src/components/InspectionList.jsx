import { useState, useMemo } from 'react'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import { FileText, Mail, Pencil, Trash2, Eye, Archive, Search, ArrowUpDown, X } from 'lucide-react'
import { formatDate } from '../lib/dateUtils'

// report_url が実ファイルパスを指していれば「保存済みPDFあり」とみなす
const hasStoredPdf = (insp) => typeof insp.report_url === 'string' && insp.report_url.startsWith('reports/')
// 'archived:' で始まれば共有ドライブへアーカイブ済み（写真・PDFはクラウドから削除済み）
const isArchived = (insp) => typeof insp.report_url === 'string' && insp.report_url.startsWith('archived:')

function InspectionList({ inspections, isLoading, onEdit, onDelete, onView, onGeneratePdf, onViewPdf, onSendReport, sendBusyId, pdfBusyId, projects = [], staff = [], isAdmin = false, myStaffId = null }) {
  // 編集/PDF発行は管理者は全件、メンバーは自分が検査官の案件のみ
  const canManage = (insp) => isAdmin || (!!myStaffId && insp.inspector_id === myStaffId)
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s.name]))

  // Badge tone マッピング（値は変えず表示色のみ）
  const getStatusTone = (status) => {
    switch (status) {
      case 'approved':  return 'success'
      case 'rejected':  return 'danger'
      case 'completed': return 'info'
      case 'pending':
      default:          return 'warning'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':  return '承認済み'
      case 'rejected':  return '要修正'
      case 'completed': return '完了'
      case 'pending':
      default:          return '未確認'
    }
  }

  // 是正サマリ（correction フィールド）を優先したステータス表示
  const getCorrectionStatus = (insp) => {
    const c = insp.correction
    // correction フィールドがない場合は従来のステータスにフォールバック
    if (!c) return null
    const { issues, approved, submitted } = c
    if (issues === 0) {
      return { label: '指摘なし', tone: 'success' }
    }
    if (approved === issues) {
      return { label: '是正完了', tone: 'success' }
    }
    if (submitted > 0) {
      return { label: '承認待ち', tone: 'info' }
    }
    // pending か rejected が残る
    return { label: '是正待ち', tone: 'warning' }
  }

  // ─── 検索・フィルター・ソート ───
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterInspector, setFilterInspector] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortKey, setSortKey] = useState('date_desc')

  // 表示用ステータスラベル（是正サマリ優先、なければ従来ステータス）
  const getDisplayStatus = (insp) => {
    const corr = getCorrectionStatus(insp)
    return corr ? corr.label : getStatusLabel(insp.status)
  }

  // ドロップダウン候補（実データに存在する値のみ）
  const projectOptions = useMemo(() => {
    const ids = [...new Set(inspections.map(i => i.project_id).filter(Boolean))]
    return ids.map(id => ({ id, name: projectMap[id] || id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }, [inspections, projects])

  const inspectorOptions = useMemo(() => {
    const ids = [...new Set(inspections.map(i => i.inspector_id).filter(Boolean))]
    return ids.map(id => ({ id, name: staffMap[id] || id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }, [inspections, staff])

  const statusOptions = useMemo(
    () => [...new Set(inspections.map(getDisplayStatus))],
    [inspections]
  )

  // フィルター適用 → ソート
  const visibleInspections = useMemo(() => {
    const kw = search.trim().toLowerCase()
    const filtered = inspections.filter(insp => {
      if (filterProject && insp.project_id !== filterProject) return false
      if (filterInspector && insp.inspector_id !== filterInspector) return false
      if (filterStatus && getDisplayStatus(insp) !== filterStatus) return false
      if (kw) {
        const hay = [
          projectMap[insp.project_id] || insp.project_id || '',
          staffMap[insp.inspector_id] || insp.inspector_id || '',
          ...(Array.isArray(insp.categories) ? insp.categories : []),
          insp.comments || ''
        ].join(' ').toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
    const byDate = (a, b) => new Date(a.inspection_date || 0) - new Date(b.inspection_date || 0)
    const byProject = (a, b) =>
      (projectMap[a.project_id] || a.project_id || '').localeCompare(projectMap[b.project_id] || b.project_id || '', 'ja')
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'date_asc': return byDate(a, b)
        case 'project':  return byProject(a, b)
        case 'status':   return getDisplayStatus(a).localeCompare(getDisplayStatus(b), 'ja')
        case 'date_desc':
        default:         return byDate(b, a)
      }
    })
  }, [inspections, search, filterProject, filterInspector, filterStatus, sortKey, projects, staff])

  const hasActiveFilter = !!(search.trim() || filterProject || filterInspector || filterStatus)
  const clearFilters = () => {
    setSearch('')
    setFilterProject('')
    setFilterInspector('')
    setFilterStatus('')
  }
  const controlCls = 'px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-400 focus:border-transparent min-h-[44px]'

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-10 h-10 border-4 border-slate-200 dark:border-ink-700 border-t-brand-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-base">読み込み中...</p>
      </div>
    )
  }

  if (inspections.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="text-6xl mb-4">📭</div>
        <p className="text-slate-600 dark:text-slate-300 text-lg font-medium">まだ点検記録がありません</p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">新規点検タブから記録を追加してください</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* ─── 検索・フィルター・ソート バー ─── */}
      <Card className="p-3 sm:p-4 space-y-2.5">
        {/* 検索 + ソート */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="現場・検査員・カテゴリで検索"
              className={`${controlCls} w-full pl-9`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select value={sortKey} onChange={e => setSortKey(e.target.value)} className={`${controlCls} flex-1 sm:flex-none`}>
              <option value="date_desc">日付（新しい順）</option>
              <option value="date_asc">日付（古い順）</option>
              <option value="project">現場名順</option>
              <option value="status">ステータス順</option>
            </select>
          </div>
        </div>
        {/* フィルター */}
        <div className="flex flex-wrap gap-2">
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={controlCls}>
            <option value="">すべての現場</option>
            {projectOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={filterInspector} onChange={e => setFilterInspector(e.target.value)} className={controlCls}>
            <option value="">すべての検査員</option>
            {inspectorOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={controlCls}>
            <option value="">すべてのステータス</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-ink-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-ink-700 transition min-h-[44px]"
            >
              <X className="w-3.5 h-3.5" />クリア
            </button>
          )}
        </div>
      </Card>

      <div className="text-sm text-slate-500 dark:text-slate-400 px-1">
        {hasActiveFilter
          ? <>表示 {visibleInspections.length} 件 <span className="text-slate-400 dark:text-slate-500">/ 全 {inspections.length} 件</span></>
          : <>全 {inspections.length} 件</>}
      </div>

      {visibleInspections.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-slate-600 dark:text-slate-300 text-base font-medium">条件に一致する点検がありません</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-brand-600 dark:text-brand-400 underline underline-offset-2 hover:text-brand-700 dark:hover:text-brand-300 text-sm"
          >
            フィルターをクリア
          </button>
        </Card>
      ) : (
      <>
      {/* モバイル: カードリスト / デスクトップ: テーブル */}

      {/* ---- カードリスト（モバイル優先、sm未満） ---- */}
      <div className="flex flex-col gap-3 sm:hidden">
        {visibleInspections.map((inspection) => {
          const hasIssues = Array.isArray(inspection.categories) && inspection.categories.length > 0
          const corrStatus = getCorrectionStatus(inspection)
          const statusTone = corrStatus ? corrStatus.tone : getStatusTone(inspection.status)
          const statusLabel = corrStatus ? corrStatus.label : getStatusLabel(inspection.status)
          return (
            <Card
              key={inspection.id}
              className="p-4 space-y-3 cursor-pointer active:opacity-80 transition"
              onClick={() => onView && onView(inspection.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(inspection.inspection_date)}</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {projectMap[inspection.project_id] || inspection.project_id || '-'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {staffMap[inspection.inspector_id] || inspection.inspector_id || '-'}
                  </p>
                </div>
                <Badge tone={statusTone}>{statusLabel}</Badge>
              </div>

              {hasIssues && (
                <div className="flex flex-wrap gap-1">
                  {inspection.categories.map(cat => (
                    <Badge key={cat} tone="danger">{cat}</Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1" onClick={e => e.stopPropagation()}>
                <Button variant="primary" size="sm" onClick={() => onView && onView(inspection.id)}>
                  <Eye size={14} />詳細
                </Button>
                {canManage(inspection) && (
                  inspection.report_url ? (
                    <Button variant="secondary" size="sm" disabled title="PDF生成済みのため編集できません">
                      編集
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => onEdit(inspection.id)}>
                      <Pencil size={14} />編集
                    </Button>
                  )
                )}
                {isArchived(inspection) ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-warning-700 dark:text-warning-400 bg-warning-50 dark:bg-warning-500/15 border border-warning-200 dark:border-warning-500/30 rounded-xl"
                    title="6ヶ月経過のため写真・PDFは社内ドライブへ移動済み"
                  >
                    <Archive size={13} />アーカイブ済み
                  </span>
                ) : hasStoredPdf(inspection) ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => onViewPdf && onViewPdf(inspection.id)}
                      className="text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    >
                      <FileText size={14} />PDF表示
                    </Button>
                    {canManage(inspection) && (
                      <Button variant="ghost" size="sm"
                        onClick={() => onSendReport && onSendReport(inspection.id)}
                        disabled={sendBusyId === inspection.id}
                        title="作業所長へPDFをメール送信（CC対象社員にも送信）"
                        className="text-success-700 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-500/10 disabled:cursor-wait"
                      >
                        <Mail size={14} />
                        {sendBusyId === inspection.id ? '送信中…' : inspection.report_sent_at ? '再送信' : 'メール送信'}
                      </Button>
                    )}
                  </>
                ) : canManage(inspection) ? (
                  <Button variant="ghost" size="sm"
                    onClick={() => onGeneratePdf && onGeneratePdf(inspection.id)}
                    disabled={pdfBusyId === inspection.id}
                    className="text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:cursor-wait"
                  >
                    <FileText size={14} />
                    {pdfBusyId === inspection.id ? '生成中…' : 'PDF生成'}
                  </Button>
                ) : null}
                {isAdmin && (
                  <Button variant="danger" size="sm" onClick={() => onDelete(inspection.id)}>
                    <Trash2 size={14} />削除
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* ---- テーブル（sm以上） ---- */}
      <div className="hidden sm:block overflow-x-auto bg-white dark:bg-ink-800 rounded-2xl border border-slate-200 dark:border-ink-700 shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-ink-700/50 border-b border-slate-200 dark:border-ink-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">日付</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">現場</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">検査員</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">指摘カテゴリ</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">ステータス</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
            {visibleInspections.map((inspection) => {
              const hasIssues = Array.isArray(inspection.categories) && inspection.categories.length > 0
              const corrStatus = getCorrectionStatus(inspection)
              const statusTone = corrStatus ? corrStatus.tone : getStatusTone(inspection.status)
              const statusLabel = corrStatus ? corrStatus.label : getStatusLabel(inspection.status)
              return (
                <tr
                  key={inspection.id}
                  className="hover:bg-slate-50 dark:hover:bg-ink-700/50 transition cursor-pointer"
                  onClick={() => onView && onView(inspection.id)}
                >
                  <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatDate(inspection.inspection_date)}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200 font-medium">
                    {projectMap[inspection.project_id] || inspection.project_id || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {staffMap[inspection.inspector_id] || inspection.inspector_id || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {hasIssues ? (
                      <div className="flex flex-wrap gap-1">
                        {inspection.categories.map(cat => (
                          <Badge key={cat} tone="danger">{cat}</Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge tone="success">指摘なし</Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <Badge tone={statusTone}>{statusLabel}</Badge>
                  </td>
                  <td className="px-4 py-4 text-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="primary" size="sm" onClick={() => onView && onView(inspection.id)}>
                        <Eye size={13} />詳細
                      </Button>
                      {canManage(inspection) && (
                        inspection.report_url ? (
                          <Button variant="secondary" size="sm" disabled title="PDF生成済みのため編集できません">
                            編集
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => onEdit(inspection.id)}>
                            <Pencil size={13} />編集
                          </Button>
                        )
                      )}
                      {isArchived(inspection) ? (
                        <span
                          title="6ヶ月経過のため写真・PDFは社内ドライブへ移動済み"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-warning-700 dark:text-warning-400 bg-warning-50 dark:bg-warning-500/15 border border-warning-200 dark:border-warning-500/30 rounded-xl whitespace-nowrap"
                        >
                          <Archive size={12} />アーカイブ済み
                        </span>
                      ) : hasStoredPdf(inspection) ? (
                        <>
                          <Button variant="ghost" size="sm"
                            onClick={() => onViewPdf && onViewPdf(inspection.id)}
                            className="text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                          >
                            <FileText size={13} />PDF表示
                          </Button>
                          {canManage(inspection) && (
                            <Button variant="ghost" size="sm"
                              onClick={() => onSendReport && onSendReport(inspection.id)}
                              disabled={sendBusyId === inspection.id}
                              title="作業所長へPDFをメール送信（CC対象社員にも送信）"
                              className="text-success-700 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-500/10 disabled:cursor-wait"
                            >
                              <Mail size={13} />
                              {sendBusyId === inspection.id ? '送信中…' : inspection.report_sent_at ? '再送信' : 'メール送信'}
                            </Button>
                          )}
                        </>
                      ) : canManage(inspection) ? (
                        <Button variant="ghost" size="sm"
                          onClick={() => onGeneratePdf && onGeneratePdf(inspection.id)}
                          disabled={pdfBusyId === inspection.id}
                          className="text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:cursor-wait"
                        >
                          <FileText size={13} />
                          {pdfBusyId === inspection.id ? '生成中…' : 'PDF生成'}
                        </Button>
                      ) : null}
                      {isAdmin && (
                        <Button variant="danger" size="sm" onClick={() => onDelete(inspection.id)}>
                          <Trash2 size={13} />削除
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  )
}

export default InspectionList
