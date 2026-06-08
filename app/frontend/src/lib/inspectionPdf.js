// 安全点検レポートの PDF 生成ユーティリティ
// 方式: オフスクリーンに帳票HTMLを描画 → html2canvas でラスタライズ → jsPDF で多ページPDF化
// 日本語はブラウザ描画をそのまま画像化するため埋め込みフォント不要。
// 画像は fetch → dataURL 化して canvas の CORS 汚染を回避する。
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('ja-JP')
  } catch {
    return dateStr
  }
}

// 画像URLを dataURL に変換（失敗時は null）
const toDataUrl = async (url) => {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// 写真を「2枚以上は横並び」で大きく表示するグリッド。
// 1枚: 大きく1枚 / 2枚以上: 2カラムで横に並べる（視認性優先で従来より大判）。
const photoGrid = (urls, urlToData) => {
  if (!urls || urls.length === 0) return ''
  const single = urls.length === 1
  // 1枚は幅広・高め、複数枚は2カラム（各 calc(50% - 5px)）で横並び
  const cellW = single ? 'width:60%;' : 'width:calc(50% - 5px);'
  const cellH = single ? 'height:260px;' : 'height:230px;'
  const cells = urls
    .map((u) => {
      const dataUrl = urlToData[u]
      const inner = dataUrl
        ? `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
        : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#9ca3af;font-size:12px;">画像読込失敗</span>`
      return `<div style="${cellW}${cellH}border:1px solid #d1d5db;border-radius:6px;overflow:hidden;background:#f3f4f6;box-sizing:border-box;">${inner}</div>`
    })
    .join('')
  return `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">${cells}</div>`
}

/**
 * 点検レポートのPDFを生成し、Blob とファイル名を返す（保存はしない）。
 * @param {object} inspection - inspection_details を含む完全な点検データ
 * @param {object} opts - { projectMap, staffMap }
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function generateInspectionPdf(inspection, { projectMap = {}, staffMap = {} } = {}) {
  const details = inspection.inspection_details || []
  const sitePhotos = Array.isArray(inspection.site_photo_urls) ? inspection.site_photo_urls : []

  // 後方互換: issue_image_urls が無ければ issue_image_url を配列化
  const getIssueImageUrls = (item) => {
    if (Array.isArray(item.issue_image_urls) && item.issue_image_urls.length > 0) return item.issue_image_urls
    if (item.issue_image_url) return [item.issue_image_url]
    return []
  }

  // すべての画像URLを収集して dataURL 化
  const allUrls = new Set()
  sitePhotos.forEach((u) => allUrls.add(u))
  details.forEach((d) => getIssueImageUrls(d).forEach((u) => allUrls.add(u)))
  const urlList = [...allUrls]
  const dataUrls = await Promise.all(urlList.map(toDataUrl))
  const urlToData = Object.fromEntries(urlList.map((u, i) => [u, dataUrls[i]]))

  // カテゴリ別グルーピング
  const grouped = details.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = []
    acc[d.category].push(d)
    return acc
  }, {})
  const issueCount = details.filter((d) => d.result === '指摘あり').length

  const projectName = projectMap[inspection.project_id] || inspection.project_id || '-'
  const inspectorName = staffMap[inspection.inspector_id] || inspection.inspector_id || '-'
  const managerName = staffMap[inspection.manager_id] || inspection.manager_id || '-'

  const detailHtml = Object.entries(grouped)
    .map(([category, items]) => {
      const rows = items
        .map((item) => {
          const isIssue = item.result === '指摘あり'
          const urls = getIssueImageUrls(item)
          const issueBlock = isIssue
            ? `
              ${item.issue_content ? `<div style="margin-top:6px;"><span style="color:#dc2626;font-size:11px;font-weight:600;">指摘内容</span><div style="font-size:12px;color:#1f2937;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:6px 8px;margin-top:2px;">${esc(item.issue_content)}</div></div>` : ''}
              ${urls.length ? `<div style="margin-top:6px;"><span style="color:#dc2626;font-size:11px;font-weight:600;">指摘写真 (${urls.length}枚)</span>${photoGrid(urls, urlToData)}</div>` : ''}
              ${item.due_date ? `<div style="margin-top:6px;"><span style="color:#dc2626;font-size:11px;font-weight:600;">改善期限</span> <span style="font-size:12px;color:#1f2937;">${formatDate(item.due_date)}</span></div>` : ''}
            `
            : ''
          return `
            <div style="padding:10px 12px;border-top:1px solid #f3f4f6;${isIssue ? 'background:#fef2f2;' : ''}">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
                <span style="font-size:13px;color:#1f2937;flex:1;">${esc(item.description)}</span>
                <span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:9999px;${isIssue ? 'background:#fecaca;color:#991b1b;' : 'background:#dcfce7;color:#166534;'}">${esc(item.result)}</span>
              </div>
              ${issueBlock}
            </div>`
        })
        .join('')
      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:14px;">
          <div style="background:#16a34a;padding:6px 12px;"><span style="color:#fff;font-weight:600;font-size:13px;">${esc(category)}</span></div>
          ${rows}
        </div>`
    })
    .join('')

  const sitePhotoHtml = sitePhotos.length
    ? `<div style="margin-top:14px;"><div style="font-size:11px;color:#6b7280;margin-bottom:4px;">現場写真</div>${photoGrid(sitePhotos, urlToData)}</div>`
    : ''

  const categoriesHtml =
    Array.isArray(inspection.categories) && inspection.categories.length
      ? `<div style="margin-top:14px;"><div style="font-size:11px;color:#6b7280;margin-bottom:4px;">対象区分</div><div>${inspection.categories
          .map((c) => `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:500;padding:2px 8px;border-radius:4px;margin:0 6px 6px 0;">${esc(c)}</span>`)
          .join('')}</div></div>`
      : ''

  // 帳票HTML（A4幅 ≒ 760px で組む）
  const html = `
    <div style="width:760px;padding:32px;background:#fff;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif;color:#111827;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #16a34a;padding-bottom:10px;margin-bottom:18px;">
        <div>
          <div style="font-size:22px;font-weight:700;">🛡️ 安全パトロール点検報告書</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">点検ID: ${esc(inspection.inspection_id || inspection.id || '-')}</div>
        </div>
        <div style="font-size:11px;color:#9ca3af;">出力日: ${formatDate(new Date().toISOString())}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:6px;">
        <div><div style="font-size:11px;color:#6b7280;">点検日</div><div style="font-size:13px;font-weight:600;">${formatDate(inspection.inspection_date)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;">現場</div><div style="font-size:13px;font-weight:600;">${esc(projectName)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;">検査員</div><div style="font-size:13px;font-weight:600;">${esc(inspectorName)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;">作業所長</div><div style="font-size:13px;font-weight:600;">${esc(managerName)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;">指摘件数</div><div style="font-size:13px;font-weight:700;color:${issueCount > 0 ? '#dc2626' : '#16a34a'};">${issueCount} 件</div></div>
      </div>

      ${inspection.comments ? `<div style="margin-top:10px;"><div style="font-size:11px;color:#6b7280;margin-bottom:2px;">コメント</div><div style="font-size:12px;background:#f9fafb;border-radius:4px;padding:6px 8px;">${esc(inspection.comments)}</div></div>` : ''}
      ${categoriesHtml}
      ${sitePhotoHtml}

      <div style="margin-top:20px;">
        <div style="font-size:12px;font-weight:600;color:#6b7280;letter-spacing:.05em;margin-bottom:8px;">点検項目</div>
        ${detailHtml || '<div style="font-size:12px;color:#9ca3af;">点検項目はありません</div>'}
      </div>
    </div>`

  // オフスクリーンに描画
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const target = container.firstElementChild
    const canvas = await html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgW = pageW
    const imgH = (canvas.height * imgW) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    // 縦に長い場合はページ分割
    let heightLeft = imgH
    let position = 0
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position -= pageH
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }

    const filename = `点検報告_${(projectName || '').replace(/[\\/:*?"<>|]/g, '')}_${formatDate(inspection.inspection_date).replace(/\//g, '')}.pdf`
    const blob = pdf.output('blob')
    return { blob, filename }
  } finally {
    document.body.removeChild(container)
  }
}
