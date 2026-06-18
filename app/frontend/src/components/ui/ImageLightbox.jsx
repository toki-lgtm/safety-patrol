/**
 * ImageLightbox - 画像拡大モーダル
 * InspectionDetail / CorrectionList / CorrectionPanel の重複JSXを集約する。
 * props:
 *   url     - 表示する画像URL（falsy なら何も表示しない）
 *   onClose - 閉じるコールバック
 */
function ImageLightbox({ url, onClose }) {
  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full mx-4">
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        >
          ✕
        </button>
        <img
          src={url}
          alt="拡大写真"
          className="w-full h-auto rounded-2xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

export default ImageLightbox
