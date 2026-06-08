import { useState, useEffect } from 'react'
import axios from 'axios'

// report_url が実ファイルパスを指していれば「保存済みPDFあり」とみなす
const hasStoredPdf = (insp) => !!insp && typeof insp.report_url === 'string' && insp.report_url.startsWith('reports/')
// 'archived:' で始まれば共有ドライブへアーカイブ済み（写真・PDFはクラウドから削除済み）
const isArchived = (insp) => !!insp && typeof insp.report_url === 'string' && insp.report_url.startsWith('archived:')

function InspectionDetail({ inspectionId, onBack, onEdit, onGeneratePdf, onViewPdf, projects = [], staff = [], isAdmin = false, myStaffId = null }) {
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
  const sitePhotos = Array.isArray(inspection.site_photo_urls) ? inspection.site_photo_urls : []
  // 編集/PDF発行は管理者は全件、メンバーは自分が検査官の案件のみ
  const canManage = isAdmin || (!!myStaffId && inspection.inspector_id === myStaffId)

  return (
    <div className="max-w-4xl mx-auto">
      {/* 操作バー */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
        >
          ← 一覧に戻る
        </button>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            inspection.report_url ? (
              <button
                disabled
                title="PDF生成済みのため編集できません"
                className="px-5 py-2.5 rounded-lg font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
              >
                🔒 編集
              </button>
            ) : (
              <button
                onClick={() => onEdit && onEdit(inspection.id)}
                className="px-5 py-2.5 rounded-lg font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
              >
                ✏️ 編集
              </button>
            )
          )}
          {isArchived(inspection) ? (
            <span
              title="6ヶ月経過のため写真・PDFは社内ドライブへ移動済み"
              className="px-5 py-2.5 rounded-lg font-medium text-amber-700 bg-amber-50 border border-amber-200"
            >
              📦 アーカイブ済み
            </span>
          ) : hasStoredPdf(inspection) ? (
            <button
              onClick={() => onViewPdf && onViewPdf(inspection.id)}
              className="px-5 py-2.5 rounded-lg font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition"
            >
              📄 PDF表示
            </button>
          ) : canManage ? (
            <button
              onClick={handleGeneratePdf}
              disabled={pdfBusy}
              className="px-5 py-2.5 rounded-lg font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition disabled:opacity-50 disabled:cursor-wait"
            >
              {pdfBusy ? '生成中…' : '📄 PDF生成'}
            </button>
          ) : null}
        </div>
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

        {/* アーカイブ済み通知 */}
        {isArchived(inspection) && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
            📦 この点検は6ヶ月経過のためアーカイブ済みです。写真・PDFは社内ドライブ（共有ドライブ）に保存されており、クラウドからは削除されています。点検記録はこのまま閲覧できます。
          </div>
        )}

        {/* 基本情報 */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">基本情報</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-xs text-gray-500">点検日</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                {inspection.inspection_date
                  ? new Date(inspection.inspection_date).toLocaleDateString('ja-JP')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">現場</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                {projectMap[inspection.project_id] || inspection.project_id || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">検査員</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                {staffMap[inspection.inspector_id] || inspection.inspector_id || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">作業所長</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">
                {staffMap[inspection.manager_id] || inspection.manager_id || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">指摘件数</dt>
              <dd className={`text-sm font-bold mt-0.5 ${issueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {issueCount} 件
              </dd>
            </div>
          </dl>

          {/* コメント */}
          {inspection.comments && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-1">コメント</dt>
              <dd className="text-sm text-gray-800 bg-gray-50 rounded px-3 py-2">{inspection.comments}</dd>
            </div>
          )}

          {/* 対象区分（選択カテゴリ） */}
          {Array.isArray(inspection.categories) && inspection.categories.length > 0 && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-1">対象区分</dt>
              <dd className="flex flex-wrap gap-2 mt-1">
                {inspection.categories.map(cat => (
                  <span key={cat} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">{cat}</span>
                ))}
              </dd>
            </div>
          )}

          {/* 現場写真 */}
          {sitePhotos.length > 0 && (
            <div className="mt-4">
              <dt className="text-xs text-gray-500 mb-2">現場写真</dt>
              <dd className="flex flex-wrap gap-2">
                {sitePhotos.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`現場写真 ${idx + 1}`}
                    onClick={() => setEnlargedImage(url)}
                    className="w-24 h-24 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-90 transition"
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
                      const imageUrls = getIssueImageUrls(item)
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

                              {/* 複数写真サムネイル */}
                              {imageUrls.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-red-600 mb-1">
                                    指摘写真 ({imageUrls.length}枚)
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {imageUrls.map((url, idx) => (
                                      <img
                                        key={idx}
                                        src={url}
                                        alt={`指摘写真 ${idx + 1}`}
                                        onClick={() => setEnlargedImage(url)}
                                        className="w-24 h-24 object-cover rounded border border-red-200 cursor-pointer hover:opacity-90 transition"
                                        title="クリックで拡大"
                                      />
                                    ))}
                                  </div>
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
