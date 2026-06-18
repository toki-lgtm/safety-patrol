import { useState } from 'react'
import axios from 'axios'
import Button from './ui/Button'
import Badge from './ui/Badge'
import ImageLightbox from './ui/ImageLightbox'
import { Camera, Check, X, Clock, Image } from 'lucide-react'
import { getApiUrl, authHeaders } from '../lib/api'

// 是正ステータスに対応するバッジ
function CorrectionStatusBadge({ status }) {
  switch (status) {
    case 'submitted':
      return <Badge tone="warning">承認待ち</Badge>
    case 'approved':
      return <Badge tone="success">是正完了</Badge>
    case 'rejected':
      return <Badge tone="danger">差し戻し</Badge>
    case 'pending':
    default:
      return <Badge tone="neutral">是正待ち</Badge>
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
    <div className="mt-4 border border-slate-200 dark:border-ink-700 rounded-xl overflow-hidden bg-white dark:bg-ink-800">
      {/* ヘッダ: 是正ステータスバッジ */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-ink-700/60 border-b border-slate-200 dark:border-ink-700">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">是正対応</span>
        <CorrectionStatusBadge status={status} />
      </div>

      <div className="p-4 space-y-4">
        {/* 差し戻し理由（danger系） */}
        {detail.reject_reason && (
          <div className="px-4 py-3 bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-xl">
            <p className="text-xs font-semibold text-danger-700 dark:text-danger-400 mb-1">差し戻し理由</p>
            <p className="text-sm text-danger-800 dark:text-danger-300">{detail.reject_reason}</p>
          </div>
        )}

        {/* ビフォーアフター: 是正写真 */}
        {correctionImages.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              <Image className="w-3.5 h-3.5" />
              是正写真 ({correctionImages.length}枚)
            </p>
            <div className="flex flex-wrap gap-2">
              {correctionImages.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`是正写真 ${idx + 1}`}
                  onClick={() => setEnlargedImage(url)}
                  className="w-20 h-20 object-cover rounded-xl bg-slate-100 dark:bg-ink-700 border border-slate-200 dark:border-ink-700 cursor-pointer hover:opacity-90 transition"
                  title="クリックで拡大"
                />
              ))}
            </div>
          </div>
        )}

        {/* 是正コメント */}
        {detail.correction_comment && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">是正コメント</p>
            <p className="text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-ink-700 rounded-xl px-4 py-2.5">{detail.correction_comment}</p>
          </div>
        )}

        {/* 日時情報 */}
        {(detail.corrected_at || detail.approved_at) && (
          <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
            {detail.corrected_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                是正提出: {formatDateTime(detail.corrected_at)}
              </span>
            )}
            {detail.approved_at && (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                承認: {formatDateTime(detail.approved_at)}
              </span>
            )}
          </div>
        )}

        {/* 是正提出フォーム（作業所長・権限あり・pending/rejected のとき） */}
        {canSubmit && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-ink-700">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">是正内容を提出する</p>

            {/* ファイル選択 */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer w-full px-4 py-3 border-2 border-dashed border-accent-300 dark:border-accent-500/40 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-accent-50 dark:hover:bg-accent-500/5 transition min-h-[44px]">
                <Camera className="w-4 h-4 text-accent-500 dark:text-accent-400 flex-shrink-0" />
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
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(files).map((f, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-accent-50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/20 text-accent-700 dark:text-accent-400 rounded-lg">
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
              className="w-full px-4 py-2.5 border border-slate-300 dark:border-ink-600 rounded-xl bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-accent-400 focus:border-transparent text-sm disabled:opacity-50 min-h-[44px]"
            />

            {/* 提出ボタン */}
            <Button
              type="button"
              variant="accent"
              size="md"
              onClick={handleSubmitCorrection}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  是正を提出
                </>
              )}
            </Button>
          </div>
        )}

        {/* 承認・差し戻しフォーム（検査官・権限あり・submitted のとき） */}
        {canReview && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-ink-700">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">是正内容を確認する</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleApprove}
                disabled={busy}
              >
                <Check className="w-4 h-4" />
                {busy ? '処理中...' : '承認'}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={() => setShowRejectForm(v => !v)}
                disabled={busy}
              >
                <X className="w-4 h-4" />
                差し戻し
              </Button>
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
                  className="w-full px-4 py-2.5 border border-danger-300 dark:border-danger-500/40 rounded-xl bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-danger-400 focus:border-transparent text-sm disabled:opacity-50 min-h-[44px]"
                />
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={handleReject}
                  disabled={busy || !rejectInput.trim()}
                  className="bg-danger-600 dark:bg-danger-600 text-white hover:bg-danger-700 dark:hover:bg-danger-700"
                >
                  {busy ? '処理中...' : '差し戻しを確定'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ImageLightbox url={enlargedImage} onClose={() => setEnlargedImage(null)} />
    </div>
  )
}

export default CorrectionPanel
