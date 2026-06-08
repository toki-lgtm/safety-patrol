import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import { FileText, Mail, Pencil, Trash2, Eye, Archive } from 'lucide-react'

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP')
    } catch {
      return dateStr
    }
  }

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
      <div className="text-sm text-slate-500 dark:text-slate-400 px-1">全 {inspections.length} 件</div>

      {/* モバイル: カードリスト / デスクトップ: テーブル */}

      {/* ---- カードリスト（モバイル優先、sm未満） ---- */}
      <div className="flex flex-col gap-3 sm:hidden">
        {inspections.map((inspection) => {
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
            {inspections.map((inspection) => {
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
    </div>
  )
}

export default InspectionList
