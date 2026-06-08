import { useState, useEffect } from 'react'
import axios from 'axios'

function InspectionDetail({ inspectionId, onBack }) {
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

  useEffect(() => {
    if (!inspectionId) return
    const fetchDetail = async () => {
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
    }
    fetchDetail()
  }, [inspectionId])

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

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center max-w-4xl mx-auto">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-600">{error}</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          ← 戻る
        </button>
      </div>
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* 戻るボタン */}
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
        >
          ← 一覧に戻る
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* ヘッダ */}
        <div className="bg-green-600 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xl font-bold text-white">点検詳細</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inspection.status)}`}>
              {getStatusLabel(inspection.status)}
            </span>
          </div>
        </div>

        {/* 基本情報 */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">基本情報</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-xs text-gray-500">点検ID</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{inspection.inspection_id || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">点検日</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                {inspection.inspection_date
                  ? new Date(inspection.inspection_date).toLocaleDateString('ja-JP')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">現場ID</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{inspection.project_id || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">検査員ID</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{inspection.inspector_id || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">作業所長ID</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{inspection.manager_id || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">指摘件数</dt>
              <dd className={`text-sm font-bold mt-0.5 ${issueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {issueCount} 件
              </dd>
            </div>
          </dl>
          {inspection.comments && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-1">コメント</dt>
              <dd className="text-sm text-gray-800 bg-gray-50 rounded px-3 py-2">{inspection.comments}</dd>
            </div>
          )}
          {Array.isArray(inspection.categories) && inspection.categories.length > 0 && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-1">指摘カテゴリ</dt>
              <dd className="flex flex-wrap gap-2 mt-1">
                {inspection.categories.map(cat => (
                  <span key={cat} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">{cat}</span>
                ))}
              </dd>
            </div>
          )}
        </div>

        {/* 点検項目詳細 */}
        {details.length > 0 && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">点検項目</h3>
            <div className="space-y-5">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-green-600 px-4 py-2">
                    <span className="text-white font-semibold text-sm">{category}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map(item => {
                      const isIssue = item.result === '指摘あり'
                      return (
                        <div key={item.id} className={`p-4 ${isIssue ? 'bg-red-50' : ''}`}>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-sm text-gray-800 flex-1">{item.description}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                              isIssue ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {item.result}
                            </span>
                          </div>

                          {/* 指摘詳細 */}
                          {isIssue && (
                            <div className="mt-3 space-y-3 pl-0 sm:pl-4">
                              {item.issue_content && (
                                <div>
                                  <p className="text-xs font-medium text-red-600 mb-1">指摘内容</p>
                                  <p className="text-sm text-gray-800 bg-red-50 border border-red-200 rounded px-3 py-2">
                                    {item.issue_content}
                                  </p>
                                </div>
                              )}
                              {item.issue_image_url && (
                                <div>
                                  <p className="text-xs font-medium text-red-600 mb-1">指摘写真</p>
                                  <img
                                    src={item.issue_image_url}
                                    alt="指摘写真"
                                    onClick={() => setEnlargedImage(item.issue_image_url)}
                                    className="w-32 h-32 object-cover rounded border border-red-200 cursor-pointer hover:opacity-90 transition"
                                    title="クリックで拡大"
                                  />
                                </div>
                              )}
                              {item.due_date && (
                                <div>
                                  <p className="text-xs font-medium text-red-600 mb-1">改善期限</p>
                                  <p className="text-sm text-gray-800">
                                    {new Date(item.due_date).toLocaleDateString('ja-JP')}
                                  </p>
                                </div>
                              )}
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
      </div>

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

export default InspectionDetail
