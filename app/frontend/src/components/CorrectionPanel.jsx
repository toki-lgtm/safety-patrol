import { useState } from 'react'
import axios from 'axios'

// getApiUrl / authHeaders をインライン定義（DashboardPage / InspectionDetail と同一ロジック）
const getApiUrl = () => {
  const isDev = process.env.NODE_ENV !== 'production'
  return isDev ? 'http://localhost:3000' : 'https://portal-api-hhlx.onrender.com'
}
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('authToken')}`
})

// 是正ステータスに対応するバッジ
function CorrectionStatusBadge({ status }) {
  switch (status) {
    case 'submitted':
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">🔵 承認待ち</span>
    case 'approved':
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">🟢 是正完了</span>
    case 'rejected':
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">🔴 差し戻し</span>
    case 'pending':
    default:
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">🟠 是正待ち</span>
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleString('ja-JP')
  } catch {
    return dateStr
  }
}

/**
 * CorrectionPanel
 * props:
 *   detail        - inspection_details の1行（correction_status 等を含む）
 *   inspection    - { id, inspector_id, manager_id } を含むオブジェクト
 *   isAdmin       - boolean
 *   myStaffId     - string|null
 *   onUpdated     - (updatedDetail) => void  ← 親への通知
 */
function CorrectionPanel({ detail, inspection, isAdmin, myStaffId, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState([])
  const [comment, setComment] = useState('')
  const [rejectInput, setRejectInput] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [enlargedImage, setEnlargedImage] = useState(null)

  if (!detail || !inspection) return null

  const status = detail.correction_status || 'pending'

  // 権限判定
  const canSubmit =
    (isAdmin || inspection.manager_id === myStaffId) &&
    (status === 'pending' || status === 'rejected')

  const canReview =
    (isAdmin || inspection.inspector_id === myStaffId) &&
    status === 'submitted'

  // 是正写真アップロード → correction API 呼び出し
  const handleSubmitCorrection = async () => {
    if (busy) return
    if (files.length === 0 && !comment.trim()) {
      alert('是正写真またはコメントを入力してください')
      return
    }
    setBusy(true)
    try {
      // 写真を1枚ずつアップロード
      const imageUrls = []
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('photo', file)
        const res = await axios.post(
          `${getApiUrl()}/api/inspections/upload-photo`,
          form,
          {
            headers: {
              ...authHeaders(),
              'Content-Type': 'multipart/form-data',
            }
          }
        )
        imageUrls.push(res.data.url)
      }

      // 是正提出
      const res = await axios.post(
        `${getApiUrl()}/api/inspections/${inspection.id}/details/${detail.id}/correction`,
        { image_urls: imageUrls, comment: comment.trim() },
        { headers: authHeaders() }
      )
      setFiles([])
      setComment('')
      onUpdated && onUpdated(res.data)
    } catch (err) {
      console.error('是正提出失敗:', err)
      alert(err.response?.data?.error || '是正の提出に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  // 承認
  const handleApprove = async () => {
    if (busy) return
    if (!confirm('この是正を承認しますか？')) return
    setBusy(true)
    try {
      const res = await axios.post(
        `${getApiUrl()}/api/inspections/${inspection.id}/details/${detail.id}/approve`,
        {},
        { headers: authHeaders() }
      )
      onUpdated && onUpdated(res.data)
    } catch (err) {
      console.error('承認失敗:', err)
      alert(err.response?.data?.error || '承認に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  // 差し戻し
  const handleReject = async () => {
    if (busy) return
    const reason = rejectInput.trim()
    if (!reason) {
      alert('差し戻し理由を入力してください')
      return
    }
    setBusy(true)
    try {
      const res = await axios.post(
        `${getApiUrl()}/api/inspections/${inspection.id}/details/${detail.id}/reject`,
        { reason },
        { headers: authHeaders() }
      )
      setRejectInput('')
      setShowRejectForm(false)
      onUpdated && onUpdated(res.data)
    } catch (err) {
      console.error('差し戻し失敗:', err)
      alert(err.response?.data?.error || '差し戻しに失敗しました')
    } finally {
      setBusy(false)
    }
  }

  const correctionImages = Array.isArray(detail.correction_image_urls)
    ? detail.correction_image_urls
    : []

  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      {/* ヘッダ: 是正ステータスバッジ */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600">是正対応</span>
        <CorrectionStatusBadge status={status} />
      </div>

      <div className="p-4 space-y-3">
        {/* 差し戻し理由（赤系） */}
        {detail.reject_reason && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-semibold text-red-700 mb-0.5">差し戻し理由</p>
            <p className="text-sm text-red-800">{detail.reject_reason}</p>
          </div>
        )}

        {/* 是正写真 */}
        {correctionImages.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">是正写真 ({correctionImages.length}枚)</p>
            <div className="flex flex-wrap gap-2">
              {correctionImages.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`是正写真 ${idx + 1}`}
                  onClick={() => setEnlargedImage(url)}
                  className="w-20 h-20 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-90 transition"
                  title="クリックで拡大"
                />
              ))}
            </div>
          </div>
        )}

        {/* 是正コメント */}
        {detail.correction_comment && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-0.5">是正コメント</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded px-3 py-2">{detail.correction_comment}</p>
          </div>
        )}

        {/* 日時情報 */}
        {(detail.corrected_at || detail.approved_at) && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {detail.corrected_at && (
              <span>是正提出: {formatDateTime(detail.corrected_at)}</span>
            )}
            {detail.approved_at && (
              <span>承認: {formatDateTime(detail.approved_at)}</span>
            )}
          </div>
        )}

        {/* 是正提出フォーム（作業所長・権限あり・pending/rejected のとき） */}
        {canSubmit && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700">是正内容を提出する</p>

            {/* ファイル選択 */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer w-full px-3 py-2 border border-dashed border-green-300 rounded-lg text-sm text-gray-500 hover:bg-green-50 transition">
                <span>📷</span>
                <span>
                  {files.length > 0
                    ? `${files.length}枚選択済み`
                    : '是正写真を選択...（複数可）'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                  disabled={busy}
                />
              </label>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Array.from(files).map((f, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 rounded">
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* コメント */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="是正コメント（任意）"
              disabled={busy}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm disabled:bg-gray-50"
            />

            {/* 提出ボタン */}
            <button
              type="button"
              onClick={handleSubmitCorrection}
              disabled={busy}
              className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait transition"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  送信中...
                </span>
              ) : '是正を提出'}
            </button>
          </div>
        )}

        {/* 承認・差し戻しフォーム（検査官・権限あり・submitted のとき） */}
        {canReview && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700">是正内容を確認する</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={busy}
                className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait transition"
              >
                {busy ? '処理中...' : '✓ 承認'}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(v => !v)}
                disabled={busy}
                className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-300 text-sm font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
              >
                ✕ 差し戻し
              </button>
            </div>

            {/* 差し戻し理由入力 */}
            {showRejectForm && (
              <div className="space-y-2">
                <textarea
                  value={rejectInput}
                  onChange={e => setRejectInput(e.target.value)}
                  rows={2}
                  placeholder="差し戻し理由を入力してください"
                  disabled={busy}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm disabled:bg-gray-50"
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={busy || !rejectInput.trim()}
                  className="px-5 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {busy ? '処理中...' : '差し戻しを確定'}
                </button>
              </div>
            )}
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

export default CorrectionPanel
