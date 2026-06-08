import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import CorrectionPanel from './CorrectionPanel'
import Button from './ui/Button'
import Card from './ui/Card'
import Badge from './ui/Badge'
import {
  ArrowLeft, Pencil, Lock, FileText, Mail, Archive,
  AlertTriangle, CheckCircle, Clock, Camera, ChevronRight
} from 'lucide-react'

// report_url が実ファイルパスを指していれば「保存済みPDFあり」とみなす
const hasStoredPdf = (insp) => !!insp && typeof insp.report_url === 'string' && insp.report_url.startsWith('reports/')
// 'archived:' で始まれば共有ドライブへアーカイブ済み（写真・PDFはクラウドから削除済み）
const isArchived = (insp) => !!insp && typeof insp.report_url === 'string' && insp.report_url.startsWith('archived:')

function InspectionDetail({ inspectionId, onBack, onEdit, onGeneratePdf, onViewPdf, onSendReport, projects = [], staff = [], isAdmin = false, myStaffId = null }) {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s.name]))
  const getApiUrl = () => {
    const isDev = process.env.NODE_ENV !== 'production'
    return isDev ? 'http://localhost:3000' : 'https://portal-api-hhlx.onrender.com'
  }

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('authToken')}`
  })

  const [inspection, setInspection] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enlargedImage, setEnlargedImage] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)

  const handleSendReport = async () => {
    if (!inspection || sendBusy || !onSendReport) return
    try {
      setSendBusy(true)
      const updated = await onSendReport(inspection.id)
      if (updated) setInspection(prev => ({ ...prev, ...updated }))
    } catch (err) {
      // 送信失敗時のメッセージは呼び出し元(DashboardPage)で表示済み
    } finally {
      setSendBusy(false)
    }
  }

  const handleGeneratePdf = async () => {
    if (!inspection || pdfBusy || !onGeneratePdf) return
    try {
      setPdfBusy(true)
      const updated = await onGeneratePdf(inspection)
      setInspection(prev => ({ ...prev, ...updated }))
      alert('PDFを生成・保存しました。「PDF表示」からいつでも閲覧できます。この点検は編集できなくなります。')
    } catch (err) {
      console.error('PDF生成に失敗:', err)
      alert('PDF生成に失敗しました')
    } finally {
      setPdfBusy(false)
    }
  }

  const fetchDetail = useCallback(async () => {
    if (!inspectionId) return
    try {
      setIsLoading(true)
      const res = await axios.get(
        `${getApiUrl()}/api/inspections/${inspectionId}`,
        { headers: authHeaders() }
      )
      setInspection(res.data)
    } catch (err) {
      console.error('詳細取得失敗:', err)
      setError('点検データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [inspectionId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return '✓ 承認済み'
      case 'rejected': return '✗ 要修正'
      case 'completed': return '✔ 完了'
      default: return '⏳ 未確認'
    }
  }

  // ステータスに対応するBadgeトーン
  const getStatusTone = (status) => {
    switch (status) {
      case 'approved': return 'success'
      case 'rejected': return 'danger'
      case 'completed': return 'info'
      default: return 'warning'
    }
  }

  // 後方互換: issue_image_urls がない場合は issue_image_url を配列に変換して返す
  const getIssueImageUrls = (item) => {
    if (Array.isArray(item.issue_image_urls) && item.issue_image_urls.length > 0) {
      return item.issue_image_urls
    }
    if (item.issue_image_url) {
      return [item.issue_image_url]
    }
    return []
  }

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-500/10 mb-4">
          <Clock className="w-6 h-6 text-brand-600 dark:text-brand-400 animate-pulse" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-base">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-danger-50 dark:bg-danger-500/10 mb-4">
          <AlertTriangle className="w-6 h-6 text-danger-500 dark:text-danger-400" />
        </div>
        <p className="text-danger-600 dark:text-danger-400 mb-4">{error}</p>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          戻る
        </Button>
      </Card>
    )
  }

  if (!inspection) return null

  // カテゴリ別グルーピング
  const details = inspection.inspection_details || []
  const grouped = details.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = []
    acc[d.category].push(d)
    return acc
  }, {})

  const issueCount = details.filter(d => d.result === '指摘あり').length
  const sitePhotos = Array.isArray(inspection.site_photo_urls) ? inspection.site_photo_urls : []
  // 編集/PDF発行は管理者は全件、メンバーは自分が検査官の案件のみ
  const canManage = isAdmin || (!!myStaffId && inspection.inspector_id === myStaffId)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 操作バー */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="md" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          一覧に戻る
        </Button>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            inspection.report_url ? (
              <Button variant="secondary" size="md" disabled title="PDF生成済みのため編集できません">
                <Lock className="w-4 h-4" />
                編集
              </Button>
            ) : (
              <Button variant="secondary" size="md" onClick={() => onEdit && onEdit(inspection.id)}>
                <Pencil className="w-4 h-4" />
                編集
              </Button>
            )
          )}
          {isArchived(inspection) ? (
            <span
              title="6ヶ月経過のため写真・PDFは社内ドライブへ移動済み"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-warning-700 dark:text-warning-400 bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/20"
            >
              <Archive className="w-4 h-4" />
              アーカイブ済み
            </span>
          ) : hasStoredPdf(inspection) ? (
            <>
              <Button variant="secondary" size="md" onClick={() => onViewPdf && onViewPdf(inspection.id)}>
                <FileText className="w-4 h-4" />
                PDF表示
              </Button>
              {canManage && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSendReport}
                  disabled={sendBusy}
                  title="作業所長へPDFをメール送信（CC対象社員にも送信）"
                >
                  <Mail className="w-4 h-4" />
                  {sendBusy ? '送信中…' : inspection.report_sent_at ? '再送信' : 'メール送信'}
                </Button>
              )}
            </>
          ) : canManage ? (
            <Button variant="secondary" size="md" onClick={handleGeneratePdf} disabled={pdfBusy}>
              <FileText className="w-4 h-4" />
              {pdfBusy ? '生成中…' : 'PDF生成'}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* ヘッダ */}
        <div className="bg-brand-600 px-6 py-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-bold text-white">点検詳細</h2>
            <Badge tone={getStatusTone(inspection.status)} className="text-sm px-3 py-1">
              {getStatusLabel(inspection.status)}
            </Badge>
          </div>
        </div>

        {/* アーカイブ済み通知 */}
        {isArchived(inspection) && (
          <div className="px-6 py-3 bg-warning-50 dark:bg-warning-500/10 border-b border-warning-200 dark:border-warning-500/20 flex items-start gap-2 text-sm text-warning-800 dark:text-warning-300">
            <Archive className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>この点検は6ヶ月経過のためアーカイブ済みです。写真・PDFは社内ドライブ（共有ドライブ）に保存されており、クラウドからは削除されています。点検記録はこのまま閲覧できます。</span>
          </div>
        )}

        {/* 基本情報 */}
        <div className="p-6 border-b border-slate-200 dark:border-ink-700">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">基本情報</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">点検日</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {inspection.inspection_date
                  ? new Date(inspection.inspection_date).toLocaleDateString('ja-JP')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">現場</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {projectMap[inspection.project_id] || inspection.project_id || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">検査員</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {staffMap[inspection.inspector_id] || inspection.inspector_id || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">作業所長</dt>
              <dd className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {staffMap[inspection.manager_id] || inspection.manager_id || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">指摘件数</dt>
              <dd className="mt-1">
                {issueCount > 0 ? (
                  <span className="text-sm font-bold text-danger-600 dark:text-danger-400">{issueCount} 件</span>
                ) : (
                  <span className="text-sm font-bold text-success-600 dark:text-success-400">{issueCount} 件</span>
                )}
              </dd>
            </div>
            {inspection.report_sent_at && (
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">メール送信</dt>
                <dd className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 mt-1">
                  <Mail className="w-3.5 h-3.5" />
                  {new Date(inspection.report_sent_at).toLocaleString('ja-JP')}
                </dd>
              </div>
            )}
          </dl>

          {/* コメント */}
          {inspection.comments && (
            <div className="mt-5">
              <dt className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">コメント</dt>
              <dd className="text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-ink-700 rounded-xl px-4 py-3">{inspection.comments}</dd>
            </div>
          )}

          {/* 対象区分（選択カテゴリ） */}
          {Array.isArray(inspection.categories) && inspection.categories.length > 0 && (
            <div className="mt-5">
              <dt className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">対象区分</dt>
              <dd className="flex flex-wrap gap-2 mt-1">
                {inspection.categories.map(cat => (
                  <Badge key={cat} tone="info">{cat}</Badge>
                ))}
              </dd>
            </div>
          )}

          {/* 現場写真 */}
          {sitePhotos.length > 0 && (
            <div className="mt-5">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
                <Camera className="w-3.5 h-3.5" />
                現場写真
              </dt>
              <dd className="flex flex-wrap gap-2">
                {sitePhotos.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`現場写真 ${idx + 1}`}
                    onClick={() => setEnlargedImage(url)}
                    className="w-24 h-24 object-cover rounded-xl bg-slate-100 dark:bg-ink-700 border border-slate-200 dark:border-ink-700 cursor-pointer hover:opacity-90 transition"
                    title="クリックで拡大"
                  />
                ))}
              </dd>
            </div>
          )}
        </div>

        {/* 点検項目詳細 */}
        {details.length > 0 && (
          <div className="p-6">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">点検項目</h3>
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="border border-slate-200 dark:border-ink-700 rounded-xl overflow-hidden">
                  {/* カテゴリヘッダ */}
                  <div className="bg-brand-600 px-4 py-2.5 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-brand-100" />
                    <span className="text-white font-semibold text-sm">{category}</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-ink-700">
                    {items.map(item => {
                      const isIssue = item.result === '指摘あり'
                      const imageUrls = getIssueImageUrls(item)
                      return (
                        <div
                          key={item.id}
                          className={`p-4 ${isIssue ? 'bg-danger-50/40 dark:bg-danger-500/5' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{item.description}</span>
                            {isIssue ? (
                              <Badge tone="danger">{item.result}</Badge>
                            ) : (
                              <Badge tone="success">{item.result}</Badge>
                            )}
                          </div>

                          {/* 指摘詳細 */}
                          {isIssue && (
                            <div className="mt-3 space-y-3 pl-0 sm:pl-4">
                              {item.issue_content && (
                                <div>
                                  <p className="text-xs font-semibold text-danger-600 dark:text-danger-400 mb-1.5">指摘内容</p>
                                  <p className="text-sm text-slate-800 dark:text-slate-200 bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-xl px-4 py-2.5">
                                    {item.issue_content}
                                  </p>
                                </div>
                              )}

                              {/* 複数写真サムネイル */}
                              {imageUrls.length > 0 && (
                                <div>
                                  <p className="flex items-center gap-1.5 text-xs font-semibold text-danger-600 dark:text-danger-400 mb-1.5">
                                    <Camera className="w-3.5 h-3.5" />
                                    指摘写真 ({imageUrls.length}枚)
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {imageUrls.map((url, idx) => (
                                      <img
                                        key={idx}
                                        src={url}
                                        alt={`指摘写真 ${idx + 1}`}
                                        onClick={() => setEnlargedImage(url)}
                                        className="w-24 h-24 object-cover rounded-xl bg-slate-100 dark:bg-ink-700 border border-danger-200 dark:border-danger-500/30 cursor-pointer hover:opacity-90 transition"
                                        title="クリックで拡大"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {item.due_date && (
                                <div>
                                  <p className="flex items-center gap-1.5 text-xs font-semibold text-danger-600 dark:text-danger-400 mb-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    改善期限
                                  </p>
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {new Date(item.due_date).toLocaleDateString('ja-JP')}
                                  </p>
                                </div>
                              )}

                              {/* 是正対応パネル */}
                              <CorrectionPanel
                                detail={item}
                                inspection={{
                                  id: inspection.id,
                                  inspector_id: inspection.inspector_id,
                                  manager_id: inspection.manager_id,
                                }}
                                isAdmin={isAdmin}
                                myStaffId={myStaffId}
                                onUpdated={(updatedDetail) => {
                                  setInspection(prev => {
                                    if (!prev) return prev
                                    return {
                                      ...prev,
                                      inspection_details: (prev.inspection_details || []).map(d =>
                                        d.id === updatedDetail.id ? { ...d, ...updatedDetail } : d
                                      )
                                    }
                                  })
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 画像拡大モーダル */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-3xl w-full mx-4">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-11 right-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              ✕
            </button>
            <img
              src={enlargedImage}
              alt="拡大写真"
              className="w-full h-auto rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectionDetail
