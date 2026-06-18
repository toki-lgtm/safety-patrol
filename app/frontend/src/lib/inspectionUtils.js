// 点検ユーティリティ
// InspectionDetail / CorrectionList / inspectionPdf.js の重複定義を集約する。

/**
 * 後方互換: issue_image_urls がない場合は issue_image_url を配列に変換して返す
 * @param {object} item - inspection_details の1行
 * @returns {string[]}
 */
export const getIssueImageUrls = (item) => {
  if (Array.isArray(item.issue_image_urls) && item.issue_image_urls.length > 0) {
    return item.issue_image_urls
  }
  if (item.issue_image_url) {
    return [item.issue_image_url]
  }
  return []
}
