import { useState, useEffect } from 'react'
import axios from 'axios'
import CorrectionPanel from './CorrectionPanel'

const getApiUrl = () => {
  const isDev = process.env.NODE_ENV !== 'production'
  return isDev ? 'http://localhost:3000' : 'https://portal-api-hhlx.onrender.com'
}
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('authToken')}`
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('ja-JP')
  } catch {
    return dateStr
  }
}

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

  // 指摘写真（後方互換）
  const getIssueImageUrls = (item) => {
    if (Array.isArray(item.issue_image_urls) && item.issue_image_urls.length > 0) {
      return item.issue_image_urls
    }
    if (item.issue_image_url) return [item.issue_image_url]
    return []
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* フィルタ切り替え */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setFilter('urgent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            filter === 'urgent'
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          🔔 要対応 ({urgentItems.length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
            filter === 'all'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          📋 すべて ({items.length})
        </button>
      </div>

      {/* 0件表示 */}
      {displayItems.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">
            {filter === 'urgent' ? '✅' : '📭'}
          </div>
          <p className="text-gray-600 text-lg">
            {filter === 'urgent'
              ? '対応が必要な指摘はありません'
              : '指摘項目がありません'}
          </p>
          {filter === 'urgent' && items.length > 0 && (
            <p className="text-gray-500 text-sm mt-2">
              <button
                onClick={() => setFilter('all')}
                className="text-green-600 underline hover:text-green-700"
              >
                すべての指摘を見る
              </button>
            </p>
          )}
        </div>
      )}

      {/* 指摘カード一覧 */}
      {displayItems.map(item => {
        const insp = item.inspections || {}
        const issueImages = getIssueImageUrls(item)
        const urgent = isUrgent(item)

        return (
          <div
            key={item.id}
            className={`bg-white rounded-lg shadow overflow-hidden border-l-4 ${
              urgent ? 'border-orange-400' : 'border-gray-200'
            }`}
          >
            {/* カードヘッダ */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-gray-800">
                    {projectMap[insp.project_id] || insp.project_id || '-'}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-600">{formatDate(insp.inspection_date)}</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                    {item.category}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                  <span>検査員: {staffMap[insp.inspector_id] || insp.inspector_id || '-'}</span>
                  <span>作業所長: {staffMap[insp.manager_id] || insp.manager_id || '-'}</span>
                </div>
              </div>
              {urgent && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold flex-shrink-0">
                  要対応
                </span>
              )}
            </div>

            <div className="p-5 space-y-3">
              {/* 指摘内容 */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">点検項目</p>
                <p className="text-sm text-gray-800">{item.description}</p>
              </div>

              {item.issue_content && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-0.5">指摘内容</p>
                  <p className="text-sm text-gray-800 bg-red-50 border border-red-100 rounded px-3 py-2">
                    {item.issue_content}
                  </p>
                </div>
              )}

              {/* 指摘写真 */}
              {issueImages.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1">指摘写真 ({issueImages.length}枚)</p>
                  <div className="flex flex-wrap gap-2">
                    {issueImages.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`指摘写真 ${idx + 1}`}
                        onClick={() => setEnlargedImage(url)}
                        className="w-20 h-20 object-cover rounded border border-red-200 cursor-pointer hover:opacity-90 transition"
                        title="クリックで拡大"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 改善期限 */}
              {item.due_date && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">改善期限</p>
                  <p className="text-sm text-gray-800">{formatDate(item.due_date)}</p>
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
          </div>
        )
      })}

      {/* 画像拡大モーダル */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-3xl w-full mx-4">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-bold hover:text-gray-300"
            >
              ✕
            </button>
            <img
              src={enlargedImage}
              alt="拡大写真"
              className="w-full h-auto rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default CorrectionList
