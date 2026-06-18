import { useState, useEffect } from 'react'
import axios from 'axios'
import CorrectionPanel from './CorrectionPanel'
import Card from './ui/Card'
import Badge from './ui/Badge'
import ImageLightbox from './ui/ImageLightbox'
import { Bell, FileText, Clock, Camera, AlertTriangle } from 'lucide-react'
import { getApiUrl, authHeaders } from '../lib/api'
import { formatDate } from '../lib/dateUtils'
import { getIssueImageUrls } from '../lib/inspectionUtils'

/**
 * CorrectionList
 * props: { projects, staff, isAdmin, myStaffId }
 */
function CorrectionList({ projects = [], staff = [], isAdmin = false, myStaffId = null }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('urgent') // 'urgent' | 'all'
  const [enlargedImage, setEnlargedImage] = useState(null)

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s.name]))

  useEffect(() => {
    const fetchCorrections = async () => {
      try {
        setIsLoading(true)
        const res = await axios.get(
          `${getApiUrl()}/api/inspections/corrections`,
          { headers: authHeaders() }
        )
        setItems(res.data || [])
      } catch (err) {
        console.error('是正一覧取得失敗:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCorrections()
  }, [])

  // 「対応が必要」の判定
  // - 自分が作業所長 (manager_id === myStaffId) で pending/rejected → 是正提出が必要
  // - 自分が検査官 (inspector_id === myStaffId) で submitted → 承認/差し戻しが必要
  const isUrgent = (item) => {
    const insp = item.inspections
    if (!insp) return false
    const status = item.correction_status || 'pending'
    if (isAdmin) {
      return status === 'pending' || status === 'rejected' || status === 'submitted'
    }
    if (insp.manager_id === myStaffId && (status === 'pending' || status === 'rejected')) return true
    if (insp.inspector_id === myStaffId && status === 'submitted') return true
    return false
  }

  // フィルタリング
  const urgentItems = items.filter(item => isUrgent(item))
  const displayItems = filter === 'urgent' ? urgentItems : items

  // detail 更新時にリスト内を差し替える
  const handleUpdated = (updatedDetail) => {
    setItems(prev => prev.map(item =>
      item.id === updatedDetail.id ? { ...item, ...updatedDetail } : item
    ))
  }

  // 是正ステータスのBadgeトーン
  const getCorrectionTone = (status) => {
    switch (status) {
      case 'approved': return 'success'
      case 'submitted': return 'warning'
      case 'rejected': return 'danger'
      default: return 'neutral'
    }
  }

  const getCorrectionLabel = (status) => {
    switch (status) {
      case 'approved': return '是正完了'
      case 'submitted': return '承認待ち'
      case 'rejected': return '差し戻し'
      default: return '是正待ち'
    }
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

  return (
    <div className="space-y-4">
      {/* フィルタ切り替え */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('urgent')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition min-h-[44px] ${
            filter === 'urgent'
              ? 'bg-accent-500 text-white border-accent-500 shadow-sm'
              : 'bg-white dark:bg-ink-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-700'
          }`}
        >
          <Bell className="w-4 h-4" />
          要対応
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
            filter === 'urgent' ? 'bg-white/20 text-white' : 'bg-accent-100 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400'
          }`}>
            {urgentItems.length}
          </span>
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition min-h-[44px] ${
            filter === 'all'
              ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
              : 'bg-white dark:bg-ink-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          すべて
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
            filter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-ink-700 text-slate-600 dark:text-slate-300'
          }`}>
            {items.length}
          </span>
        </button>
      </div>

      {/* 0件表示 */}
      {displayItems.length === 0 && (
        <Card className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success-50 dark:bg-success-500/10 mb-4">
            {filter === 'urgent'
              ? <Bell className="w-7 h-7 text-success-600 dark:text-success-400" />
              : <FileText className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            }
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-base font-medium">
            {filter === 'urgent'
              ? '対応が必要な指摘はありません'
              : '指摘項目がありません'}
          </p>
          {filter === 'urgent' && items.length > 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              <button
                onClick={() => setFilter('all')}
                className="text-brand-600 dark:text-brand-400 underline underline-offset-2 hover:text-brand-700 dark:hover:text-brand-300"
              >
                すべての指摘を見る
              </button>
            </p>
          )}
        </Card>
      )}

      {/* 指摘カード一覧 */}
      {displayItems.map(item => {
        const insp = item.inspections || {}
        const issueImages = getIssueImageUrls(item)
        const urgent = isUrgent(item)
        const correctionStatus = item.correction_status || 'pending'

        return (
          <Card
            key={item.id}
            className={`overflow-hidden border-l-4 ${
              urgent ? 'border-l-accent-500' : 'border-l-slate-200 dark:border-l-ink-700'
            }`}
          >
            {/* カードヘッダ */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-ink-700/60 border-b border-slate-200 dark:border-ink-700 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {projectMap[insp.project_id] || insp.project_id || '-'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(insp.inspection_date)}
                  </span>
                  <Badge tone="danger">{item.category}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span>検査員: {staffMap[insp.inspector_id] || insp.inspector_id || '-'}</span>
                  <span>作業所長: {staffMap[insp.manager_id] || insp.manager_id || '-'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {urgent && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-100 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400 rounded-full text-xs font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    要対応
                  </span>
                )}
                <Badge tone={getCorrectionTone(correctionStatus)}>
                  {getCorrectionLabel(correctionStatus)}
                </Badge>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* 指摘内容 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">点検項目</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">{item.description}</p>
              </div>

              {item.issue_content && (
                <div>
                  <p className="text-xs font-semibold text-danger-600 dark:text-danger-400 mb-1.5">指摘内容</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 bg-danger-50 dark:bg-danger-500/10 border border-danger-100 dark:border-danger-500/20 rounded-xl px-4 py-2.5">
                    {item.issue_content}
                  </p>
                </div>
              )}

              {/* 指摘写真 */}
              {issueImages.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-danger-600 dark:text-danger-400 mb-2">
                    <Camera className="w-3.5 h-3.5" />
                    指摘写真 ({issueImages.length}枚)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {issueImages.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`指摘写真 ${idx + 1}`}
                        onClick={() => setEnlargedImage(url)}
                        className="w-20 h-20 object-cover rounded-xl bg-slate-100 dark:bg-ink-700 border border-danger-200 dark:border-danger-500/30 cursor-pointer hover:opacity-90 transition"
                        title="クリックで拡大"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 改善期限 */}
              {item.due_date && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    改善期限
                  </p>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(item.due_date)}</p>
                </div>
              )}

              {/* 是正パネル */}
              <CorrectionPanel
                detail={item}
                inspection={insp}
                isAdmin={isAdmin}
                myStaffId={myStaffId}
                onUpdated={handleUpdated}
              />
            </div>
          </Card>
        )
      })}

      <ImageLightbox url={enlargedImage} onClose={() => setEnlargedImage(null)} />
    </div>
  )
}

export default CorrectionList
