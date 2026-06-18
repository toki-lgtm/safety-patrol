// 日付フォーマットユーティリティ
// InspectionList / CorrectionList / inspectionPdf.js の重複定義を集約する。

export const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('ja-JP')
  } catch {
    return dateStr
  }
}
