// 安全点検レポートの PDF 生成ユーティリティ
// 方式: 帳票HTMLをオフスクリーンに描画 → html2canvas で1枚にラスタライズ →
//       「ブロック（.pdf-block）」単位で高さを測り、ページ境界をまたぐ前に改ページして配置。
//       これにより写真・点検項目がページ途中で分断されない。日本語はDOM描画の画像化で対応（フォント埋込不要）。
//       画像は fetch → dataURL 化して canvas の CORS 汚染を回避する。
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

// 写真サムネイルのグリッド。報告書向けに小型・整列。columns/height で密度を調整。
// caption を渡すと各写真に「caption+連番」のキャプションを付ける。
const photoGrid = (urls, urlToData, { columns = 3, height = 120, caption = '' } = {}) => {
  if (!urls || urls.length === 0) return ''
  const cellW = `calc(${(100 / columns).toFixed(4)}% - ${((columns - 1) * 8) / columns}px)`
  const cells = urls
    .map((u, i) => {
      const dataUrl = urlToData[u]
      const img = dataUrl
        ? `<img src="${dataUrl}" style="width:100%;height:${height}px;object-fit:cover;display:block;" />`
        : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:${height}px;color:#9ca3af;font-size:11px;">画像読込失敗</span>`
      const cap = caption
        ? `<div style="font-size:9px;color:#6b7280;padding:2px 5px;background:#f9fafb;border-top:1px solid #e5e7eb;">${esc(caption)}${i + 1}</div>`
        : ''
      return `<div style="width:${cellW};border:1px solid #d1d5db;border-radius:4px;overflow:hidden;background:#f3f4f6;box-sizing:border-box;">${img}${cap}</div>`
    })
    .join('')
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;">${cells}</div>`
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

  // ===== ブロック（.pdf-block）を組み立てる =====
  // 各ブロックは padding-top で上の余白を確保（margin は getBoundingClientRect に反映されないため使わない）。

  // ヘッダー
  const headerBlock = `
    <div class="pdf-block" style="padding-bottom:10px;border-bottom:3px solid #16a34a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <div style="font-size:20px;font-weight:700;color:#111827;letter-spacing:.02em;">安全パトロール点検報告書</div>
          <div style="font-size:11px;color:#6b7280;margin-top:3px;">点検ID: ${esc(inspection.inspection_id || inspection.id || '-')}</div>
        </div>
        <div style="font-size:10px;color:#9ca3af;">出力日: ${formatDate(new Date().toISOString())}</div>
      </div>
    </div>`

  // 基本情報（罫線テーブル）
  const thS = 'padding:6px 10px;background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;text-align:left;border:1px solid #e5e7eb;white-space:nowrap;width:90px;'
  const tdS = 'padding:6px 10px;color:#111827;font-size:12px;font-weight:600;border:1px solid #e5e7eb;'
  const infoBlock = `
    <div class="pdf-block" style="padding-top:14px;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <tr>
          <th style="${thS}">点検日</th><td style="${tdS}">${formatDate(inspection.inspection_date)}</td>
          <th style="${thS}">現場</th><td style="${tdS}" colspan="3">${esc(projectName)}</td>
        </tr>
        <tr>
          <th style="${thS}">検査員</th><td style="${tdS}">${esc(inspectorName)}</td>
          <th style="${thS}">作業所長</th><td style="${tdS}">${esc(managerName)}</td>
          <th style="${thS}">指摘件数</th>
          <td style="${tdS}"><span style="color:${issueCount > 0 ? '#dc2626' : '#16a34a'};font-weight:700;">${issueCount} 件</span></td>
        </tr>
      </table>
    </div>`

  // コメント
  const commentBlock = inspection.comments
    ? `<div class="pdf-block" style="padding-top:12px;">
         <div style="font-size:11px;color:#6b7280;margin-bottom:3px;">コメント</div>
         <div style="font-size:12px;color:#1f2937;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:7px 10px;">${esc(inspection.comments)}</div>
       </div>`
    : ''

  // 対象区分
  const categoriesBlock =
    Array.isArray(inspection.categories) && inspection.categories.length
      ? `<div class="pdf-block" style="padding-top:12px;">
           <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">対象区分</div>
           <div>${inspection.categories
             .map((c) => `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:500;padding:3px 9px;border-radius:4px;margin:0 6px 6px 0;">${esc(c)}</span>`)
             .join('')}</div>
         </div>`
      : ''

  // 現場写真（小型・3列）
  const sitePhotoBlock = sitePhotos.length
    ? `<div class="pdf-block" style="padding-top:12px;">
         <div style="font-size:11px;color:#6b7280;margin-bottom:5px;">現場写真</div>
         ${photoGrid(sitePhotos, urlToData, { columns: 3, height: 115 })}
       </div>`
    : ''

  // 点検項目（カテゴリ見出し＋項目を個別ブロックに）
  const sectionTitleBlock = details.length
    ? `<div class="pdf-block" style="padding-top:18px;">
         <div style="font-size:13px;font-weight:700;color:#111827;border-left:4px solid #16a34a;padding-left:8px;">点検項目</div>
       </div>`
    : ''

  const itemsBlocks = Object.entries(grouped)
    .map(([category, items]) => {
      // カテゴリ見出し帯（data-heading: 直後の改ページで孤立しないよう配置時に判定）
      const head = `
        <div class="pdf-block" data-heading="1" style="padding-top:12px;">
          <div style="background:#16a34a;padding:6px 12px;border-radius:4px 4px 0 0;">
            <span style="color:#fff;font-weight:600;font-size:12px;">${esc(category)}</span>
          </div>
        </div>`

      const rows = items
        .map((item, idx) => {
          const isIssue = item.result === '指摘あり'
          const topBorder = idx === 0 ? '' : 'border-top:1px solid #f0f0f0;'
          if (!isIssue) {
            // 良: 1行のコンパクト表示
            return `
              <div class="pdf-block" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 12px;${topBorder}background:#fff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                <span style="font-size:12px;color:#1f2937;flex:1;">${esc(item.description)}</span>
                <span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:9999px;background:#dcfce7;color:#166534;">良</span>
              </div>`
          }
          // 指摘あり: 強調カード（内容＋写真＋期限を内包）
          const urls = getIssueImageUrls(item)
          const issueContent = item.issue_content
            ? `<div style="margin-top:7px;">
                 <span style="color:#dc2626;font-size:10px;font-weight:700;">指摘内容</span>
                 <div style="font-size:12px;color:#1f2937;background:#fff;border:1px solid #fecaca;border-radius:4px;padding:6px 9px;margin-top:2px;">${esc(item.issue_content)}</div>
               </div>`
            : ''
          const photos = urls.length
            ? `<div style="margin-top:7px;">
                 <span style="color:#dc2626;font-size:10px;font-weight:700;">指摘写真（${urls.length}枚）</span>
                 <div style="margin-top:3px;">${photoGrid(urls, urlToData, { columns: 2, height: 150, caption: '写真' })}</div>
               </div>`
            : ''
          const due = item.due_date
            ? `<div style="margin-top:7px;font-size:11px;"><span style="color:#dc2626;font-weight:700;">改善期限</span> <span style="color:#1f2937;">${formatDate(item.due_date)}</span></div>`
            : ''
          return `
            <div class="pdf-block" style="padding:10px 12px;${topBorder}background:#fef2f2;border-left:3px solid #dc2626;border-right:1px solid #fecaca;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                <span style="font-size:12px;color:#111827;font-weight:600;flex:1;">${esc(item.description)}</span>
                <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:9999px;background:#fecaca;color:#991b1b;">指摘あり</span>
              </div>
              ${issueContent}${photos}${due}
            </div>`
        })
        .join('')

      // カテゴリ末尾に下罫線ブロック（枠の底）
      const foot = `<div class="pdf-block" style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 4px 4px;height:2px;"></div>`
      return head + rows + foot
    })
    .join('')

  const html = `
    <div id="pdf-root" style="width:760px;padding:24px;background:#fff;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif;color:#111827;box-sizing:border-box;">
      ${headerBlock}
      ${infoBlock}
      ${commentBlock}
      ${categoriesBlock}
      ${sitePhotoBlock}
      ${sectionTitleBlock}
      ${itemsBlocks || (details.length ? '' : '<div class="pdf-block" style="padding-top:14px;font-size:12px;color:#9ca3af;">点検項目はありません</div>')}
    </div>`

  // オフスクリーンに描画
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const root = container.querySelector('#pdf-root')

    // 各ブロックの位置・高さ（CSS px, root先頭基準）を測定
    const rootRect = root.getBoundingClientRect()
    const blocks = [...root.querySelectorAll('.pdf-block')].map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top - rootRect.top, height: r.height, heading: el.hasAttribute('data-heading') }
    })

    const scale = 2
    const canvas = await html2canvas(root, { scale, useCORS: true, backgroundColor: '#ffffff' })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const marginX = 8
    const marginTop = 10
    const marginBottom = 12
    const contentWmm = pageW - marginX * 2
    const mmPerPx = contentWmm / root.offsetWidth
    const usableTop = marginTop
    const usableBottom = pageH - marginBottom
    const pageCapPx = (usableBottom - usableTop) / mmPerPx

    // canvas の一部（topPx〜topPx+heightPx）を切り出して yMm に配置
    const placeSlice = (topPx, heightPx, yMm) => {
      const sx = 0
      const sy = Math.round(topPx * scale)
      const sw = canvas.width
      const sh = Math.max(1, Math.round(heightPx * scale))
      const sc = document.createElement('canvas')
      sc.width = sw
      sc.height = sh
      const cx = sc.getContext('2d')
      cx.fillStyle = '#ffffff'
      cx.fillRect(0, 0, sw, sh)
      cx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
      const data = sc.toDataURL('image/jpeg', 0.92)
      pdf.addImage(data, 'JPEG', marginX, yMm, contentWmm, heightPx * mmPerPx)
    }

    let cursor = usableTop
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      const hmm = b.height * mmPerPx

      // 1ページに収まらない巨大ブロックは従来どおりスライス（写真小型化でほぼ発生しない安全網）
      if (hmm > usableBottom - usableTop) {
        if (cursor > usableTop) {
          pdf.addPage()
          cursor = usableTop
        }
        let remaining = b.height
        let offset = 0
        while (remaining > 0) {
          const sliceH = Math.min(remaining, pageCapPx)
          placeSlice(b.top + offset, sliceH, usableTop)
          remaining -= sliceH
          offset += sliceH
          if (remaining > 0) pdf.addPage()
        }
        cursor = usableBottom // 次ブロックは新ページから
        continue
      }

      // 通常ブロック: ページをまたぐなら改ページ
      const needNewPage =
        cursor + hmm > usableBottom ||
        // 見出しが下端に孤立しないよう、後続を置く余裕（約24mm）が無ければ改ページ
        (b.heading && cursor + hmm + 24 > usableBottom)
      if (needNewPage && cursor > usableTop) {
        pdf.addPage()
        cursor = usableTop
      }
      placeSlice(b.top, b.height, cursor)
      cursor += hmm
    }

    // フッター（ページ番号）を全ページに付与（標準フォント＝数字のみ）
    const pageCount = pdf.internal.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p)
      pdf.setFontSize(8)
      pdf.setTextColor(160)
      pdf.text(`${p} / ${pageCount}`, pageW / 2, pageH - 5, { align: 'center' })
    }

    const filename = `点検報告_${(projectName || '').replace(/[\\/:*?"<>|]/g, '')}_${formatDate(inspection.inspection_date).replace(/\//g, '')}.pdf`
    const blob = pdf.output('blob')
    return { blob, filename }
  } finally {
    document.body.removeChild(container)
  }
}
