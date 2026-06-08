import { useState, useEffect } from 'react'
import axios from 'axios'

function InspectionForm({ inspection, onSubmit }) {
  const getApiUrl = () => {
    const isDev = process.env.NODE_ENV !== 'production'
    return isDev ? 'http://localhost:3000' : 'https://portal-api-hhlx.onrender.com'
  }

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('authToken')}`
  })

  const today = new Date().toISOString().split('T')[0]
  const plusDays = (base, n) => {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  }

  // ウィザードのステップ管理
  // steps: ['basic', ...categoryNames, 'summary']
  const [currentStep, setCurrentStep] = useState(0)

  // Step1: 基本情報
  const [header, setHeader] = useState({
    inspection_date: today,
    project_id: '',
    inspector_id: '',
    manager_id: '',
  })
  const [selectedCategories, setSelectedCategories] = useState([]) // 選択したカテゴリ名の配列

  // マスタデータ
  const [staff, setStaff] = useState([])
  const [projects, setProjects] = useState([])
  const [inspectionItems, setInspectionItems] = useState([]) // { id, category, description }
  const [allCategories, setAllCategories] = useState([]) // 重複排除カテゴリ一覧
  const [issueTemplates, setIssueTemplates] = useState({}) // { [item_id]: [{ content, use_count }] } 過去の指摘内容

  // 各 item_id に対する評価状態
  // { [item_id]: { result: '良'|'指摘あり', issue_content: '', issue_image_urls: [], due_date: '', uploading: false } }
  const [itemStates, setItemStates] = useState({})

  // 最終ステップ: コメント＋現場写真
  const [comments, setComments] = useState('')
  const [sitePhotoUrls, setSitePhotoUrls] = useState([])
  const [sitePhotoUploading, setSitePhotoUploading] = useState(false)

  const [masterLoading, setMasterLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // マスタ取得
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setMasterLoading(true)
        const [staffRes, projectsRes, itemsRes, templatesRes] = await Promise.all([
          axios.get(`${getApiUrl()}/api/masters/staff`, { headers: authHeaders() }),
          axios.get(`${getApiUrl()}/api/masters/projects`, { headers: authHeaders() }),
          axios.get(`${getApiUrl()}/api/masters/inspection-items`, { headers: authHeaders() }),
          // 過去の指摘内容テンプレート（取得失敗しても点検入力は続行できるよう握りつぶす）
          axios.get(`${getApiUrl()}/api/issue-templates`, { headers: authHeaders() }).catch(() => ({ data: [] })),
        ])
        setStaff(staffRes.data)
        setProjects(projectsRes.data)
        setInspectionItems(itemsRes.data)

        // 指摘内容テンプレートを item_id 別にグルーピング（use_count 降順は API 側で済み）
        const tplByItem = {}
        for (const t of (templatesRes.data || [])) {
          if (!t.item_id) continue
          if (!tplByItem[t.item_id]) tplByItem[t.item_id] = []
          tplByItem[t.item_id].push({ content: t.content, use_count: t.use_count })
        }
        setIssueTemplates(tplByItem)

        // カテゴリ一覧（重複排除・順序維持）
        const cats = [...new Set(itemsRes.data.map(item => item.category))]
        setAllCategories(cats)

        // itemStates を初期化（全件「良」）
        const init = {}
        for (const item of itemsRes.data) {
          init[item.id] = {
            result: '良',
            issue_content: '',
            issue_image_urls: [],
            due_date: plusDays(today, 7),
            uploading: false,
          }
        }
        setItemStates(init)
      } catch (err) {
        console.error('マスタ取得失敗:', err)
      } finally {
        setMasterLoading(false)
      }
    }
    fetchAll()
  }, [])

  // 編集時のデータ反映
  useEffect(() => {
    if (!inspection) return
    setHeader({
      inspection_date: inspection.inspection_date || today,
      project_id: inspection.project_id || '',
      inspector_id: inspection.inspector_id || '',
      manager_id: inspection.manager_id || '',
    })
    setComments(inspection.comments || '')
    setSitePhotoUrls(inspection.site_photo_urls || [])
    if (Array.isArray(inspection.categories)) {
      setSelectedCategories(inspection.categories)
    }
    if (inspection.inspection_details && inspection.inspection_details.length > 0) {
      setItemStates(prev => {
        const next = { ...prev }
        for (const d of inspection.inspection_details) {
          if (next[d.item_id] !== undefined) {
            // 後方互換: 旧 issue_image_url を配列に変換
            const urls = d.issue_image_urls
              ? d.issue_image_urls
              : d.issue_image_url
              ? [d.issue_image_url]
              : []
            next[d.item_id] = {
              result: d.result,
              issue_content: d.issue_content || '',
              issue_image_urls: urls,
              due_date: d.due_date || plusDays(inspection.inspection_date || today, 7),
              uploading: false,
            }
          }
        }
        return next
      })
    }
  }, [inspection])

  // ステップリスト: ['basic', ...selectedCategories, 'summary']
  const steps = ['basic', ...selectedCategories, 'summary']
  const totalSteps = steps.length
  const currentStepName = steps[currentStep]
  const isSummaryStep = currentStepName === 'summary'
  const isBasicStep = currentStepName === 'basic'

  // カテゴリステップかどうか
  const isCategoryStep = !isBasicStep && !isSummaryStep
  const categoryStepIndex = isCategoryStep
    ? selectedCategories.indexOf(currentStepName)
    : -1

  // 現在のカテゴリに属する項目
  const currentItems = isCategoryStep
    ? inspectionItems.filter(item => item.category === currentStepName)
    : []

  // ヘッダ変更
  const handleHeaderChange = (e) => {
    const { name, value } = e.target
    setHeader(prev => ({ ...prev, [name]: value }))
    if (name === 'inspection_date') {
      setItemStates(prev => {
        const next = { ...prev }
        for (const id in next) {
          next[id] = { ...next[id], due_date: plusDays(value, 7) }
        }
        return next
      })
    }
  }

  // カテゴリ選択トグル
  const handleCategoryToggle = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    )
  }

  // 評価切替
  const handleResultToggle = (itemId, result) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], result }
    }))
  }

  // 指摘テキスト変更
  const handleIssueChange = (itemId, field, value) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }))
  }

  // 指摘写真アップロード（複数・配列に push）
  const handlePhotoUpload = async (itemId, files) => {
    if (!files || files.length === 0) return
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], uploading: true }
    }))
    try {
      const uploadedUrls = []
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
        uploadedUrls.push(res.data.url)
      }
      setItemStates(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          issue_image_urls: [...prev[itemId].issue_image_urls, ...uploadedUrls],
          uploading: false,
        }
      }))
    } catch (err) {
      console.error('写真アップロード失敗:', err)
      alert('写真のアップロードに失敗しました')
      setItemStates(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], uploading: false }
      }))
    }
  }

  // 指摘写真削除（クライアント側のみ）
  const handlePhotoRemove = (itemId, index) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        issue_image_urls: prev[itemId].issue_image_urls.filter((_, i) => i !== index)
      }
    }))
  }

  // 現場写真アップロード
  const handleSitePhotoUpload = async (files) => {
    if (!files || files.length === 0) return
    setSitePhotoUploading(true)
    try {
      const uploadedUrls = []
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
        uploadedUrls.push(res.data.url)
      }
      setSitePhotoUrls(prev => [...prev, ...uploadedUrls])
    } catch (err) {
      console.error('現場写真アップロード失敗:', err)
      alert('写真のアップロードに失敗しました')
    } finally {
      setSitePhotoUploading(false)
    }
  }

  // 現場写真削除
  const handleSitePhotoRemove = (index) => {
    setSitePhotoUrls(prev => prev.filter((_, i) => i !== index))
  }

  // Step1 → 次へ: バリデーション
  const handleNextFromBasic = () => {
    if (!header.project_id || !header.inspector_id) {
      alert('現場と検査員は必須です')
      return
    }
    if (selectedCategories.length === 0) {
      alert('対象区分を1つ以上選択してください')
      return
    }
    setCurrentStep(1)
  }

  // カテゴリステップ → 次へ: 指摘ありで内容未入力チェック
  const handleNextFromCategory = () => {
    for (const item of currentItems) {
      const st = itemStates[item.id]
      if (st && st.result === '指摘あり' && !st.issue_content.trim()) {
        alert(`「${item.description}」の指摘内容を入力してください`)
        return
      }
    }
    setCurrentStep(prev => prev + 1)
  }

  // 戻る
  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }

  // 保存
  const handleSubmit = async () => {
    // 選択カテゴリに属する全項目を details に含める
    const targetItems = inspectionItems.filter(item =>
      selectedCategories.includes(item.category)
    )

    const details = targetItems.map(item => {
      const st = itemStates[item.id] || { result: '良', issue_image_urls: [] }
      const base = {
        item_id: item.id,
        category: item.category,
        description: item.description,
        result: st.result,
      }
      if (st.result === '指摘あり') {
        base.issue_content = st.issue_content
        base.issue_image_urls = st.issue_image_urls || []
        base.due_date = st.due_date
      }
      return base
    })

    const payload = {
      project_id: header.project_id,
      inspector_id: header.inspector_id,
      manager_id: header.manager_id || null,
      inspection_date: header.inspection_date,
      status: 'completed',
      categories: selectedCategories,
      comments,
      site_photo_urls: sitePhotoUrls,
      details,
    }

    setSubmitting(true)
    try {
      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  if (masterLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">マスタデータを読み込み中...</p>
      </div>
    )
  }

  // ---- プログレスバー ----
  const ProgressBar = () => (
    <div className="px-6 pt-5 pb-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, idx) => {
          const label =
            step === 'basic'
              ? '基本情報'
              : step === 'summary'
              ? 'まとめ'
              : step
          const isDone = idx < currentStep
          const isCurrent = idx === currentStep
          return (
            <div key={step} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition ${
                  isDone
                    ? 'bg-green-600 border-green-600 text-white'
                    : isCurrent
                    ? 'bg-white border-green-600 text-green-600'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent ? 'text-green-700 font-semibold' : isDone ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
              {idx < steps.length - 1 && (
                <div className={`w-4 h-0.5 mx-1 ${idx < currentStep ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ---- Step 1: 基本情報 ----
  const StepBasic = () => (
    <div className="p-6 space-y-5">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">基本情報</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            点検日 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="inspection_date"
            value={header.inspection_date}
            onChange={handleHeaderChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            現場 <span className="text-red-500">*</span>
          </label>
          <select
            name="project_id"
            value={header.project_id}
            onChange={handleHeaderChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base bg-white"
          >
            <option value="">選択してください</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            検査員 <span className="text-red-500">*</span>
          </label>
          <select
            name="inspector_id"
            value={header.inspector_id}
            onChange={handleHeaderChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base bg-white"
          >
            <option value="">選択してください</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            作業所長
          </label>
          <select
            name="manager_id"
            value={header.manager_id}
            onChange={handleHeaderChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base bg-white"
          >
            <option value="">選択してください</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 対象区分選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          対象区分 <span className="text-red-500">*</span>
          <span className="ml-2 text-xs text-gray-500 font-normal">（1つ以上選択してください）</span>
        </label>
        {allCategories.length === 0 ? (
          <p className="text-gray-400 text-sm">カテゴリマスタが登録されていません</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allCategories.map(cat => {
              const checked = selectedCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition text-left ${
                    checked
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                    checked ? 'bg-green-600 border-green-600' : 'border-gray-300'
                  }`}>
                    {checked && <span className="text-white text-xs font-bold">✓</span>}
                  </span>
                  {cat}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 次へボタン */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleNextFromBasic}
          className="px-8 py-4 bg-green-600 text-white font-semibold text-base rounded-lg hover:bg-green-700 transition"
        >
          次へ →
        </button>
      </div>
    </div>
  )

  // ---- Step 2〜N: カテゴリ別詳細点検 ----
  const StepCategory = () => (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">
        <span className="text-gray-400 text-sm font-normal mr-2">
          {categoryStepIndex + 2} / {totalSteps - 1}
        </span>
        {currentStepName}
      </h3>

      {currentItems.length === 0 ? (
        <p className="text-gray-400 text-sm py-4">このカテゴリに点検項目がありません</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {currentItems.map(item => {
            const st = itemStates[item.id] || {
              result: '良',
              issue_content: '',
              issue_image_urls: [],
              due_date: plusDays(header.inspection_date, 7),
              uploading: false,
            }
            const isIssue = st.result === '指摘あり'
            return (
              <div key={item.id} className={`p-4 ${isIssue ? 'bg-red-50' : 'bg-white'}`}>
                {/* 項目名 + 評価トグル */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm text-gray-800 flex-1 min-w-0">{item.description}</span>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleResultToggle(item.id, '良')}
                      className={`px-5 py-2.5 text-sm font-medium transition ${
                        !isIssue
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      良
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResultToggle(item.id, '指摘あり')}
                      className={`px-5 py-2.5 text-sm font-medium transition border-l border-gray-300 ${
                        isIssue
                          ? 'bg-red-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      指摘あり
                    </button>
                  </div>
                </div>

                {/* 指摘あり展開エリア */}
                {isIssue && (
                  <div className="mt-4 space-y-4 pl-0 sm:pl-4">
                    {/* 指摘内容 */}
                    <div>
                      <label className="block text-xs font-medium text-red-700 mb-1">
                        指摘内容 <span className="text-red-500">*</span>
                      </label>

                      {/* 過去の指摘内容から選択（同じ項目で過去に入力したもの）。クリックで下の入力欄に反映 */}
                      {(issueTemplates[item.id]?.length > 0) && (
                        <div className="mb-2">
                          <p className="text-[11px] text-gray-500 mb-1">よく使う指摘内容（タップで入力）</p>
                          <div className="flex flex-wrap gap-1.5">
                            {issueTemplates[item.id].map((tpl, ti) => {
                              const selected = st.issue_content === tpl.content
                              return (
                                <button
                                  key={ti}
                                  type="button"
                                  onClick={() => handleIssueChange(item.id, 'issue_content', tpl.content)}
                                  title={tpl.content}
                                  className={`max-w-full text-left text-xs px-2.5 py-1.5 rounded-full border transition truncate ${
                                    selected
                                      ? 'bg-red-600 border-red-600 text-white'
                                      : 'bg-white border-red-300 text-red-700 hover:bg-red-100'
                                  }`}
                                >
                                  {tpl.content.length > 40 ? tpl.content.slice(0, 40) + '…' : tpl.content}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <textarea
                        value={st.issue_content}
                        onChange={e => handleIssueChange(item.id, 'issue_content', e.target.value)}
                        rows={2}
                        placeholder="指摘内容を入力（過去の指摘から選んで編集も可）"
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                      />
                    </div>

                    {/* 指摘写真（複数枚） */}
                    <div>
                      <label className="block text-xs font-medium text-red-700 mb-1">指摘写真（複数可）</label>
                      {st.uploading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-green-600 rounded-full animate-spin"></span>
                          アップロード中...
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* サムネイル一覧 */}
                          {st.issue_image_urls.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {st.issue_image_urls.map((url, idx) => (
                                <div key={idx} className="relative">
                                  <img
                                    src={url}
                                    alt={`指摘写真 ${idx + 1}`}
                                    className="w-20 h-20 object-cover rounded border border-gray-300"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoRemove(item.id, idx)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 追加ボタン */}
                          <label className="flex items-center gap-2 cursor-pointer w-full px-3 py-2 border border-dashed border-red-300 rounded-lg text-sm text-gray-500 hover:bg-red-50 transition">
                            <span>📷</span>
                            <span>写真を追加...</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={e => handlePhotoUpload(item.id, e.target.files)}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* 改善期限 */}
                    <div>
                      <label className="block text-xs font-medium text-red-700 mb-1">
                        改善期限（既定: 点検日+7日）
                      </label>
                      <input
                        type="date"
                        value={st.due_date}
                        onChange={e => handleIssueChange(item.id, 'due_date', e.target.value)}
                        className="px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 戻る / 次へ */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="px-8 py-4 bg-gray-100 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-200 transition"
        >
          ← 戻る
        </button>
        <button
          type="button"
          onClick={handleNextFromCategory}
          className="px-8 py-4 bg-green-600 text-white font-semibold text-base rounded-lg hover:bg-green-700 transition"
        >
          次へ →
        </button>
      </div>
    </div>
  )

  // ---- 最終ステップ: まとめ ----
  const StepSummary = () => (
    <div className="p-6 space-y-5">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">まとめ</h3>

      {/* コメント */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          コメント（任意）
        </label>
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          rows={3}
          placeholder="全体コメントがあれば入力"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
        />
      </div>

      {/* 現場写真（複数枚） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          現場写真（複数可）
        </label>
        {sitePhotoUploading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-green-600 rounded-full animate-spin"></span>
            アップロード中...
          </div>
        ) : (
          <div className="space-y-2">
            {sitePhotoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sitePhotoUrls.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={url}
                      alt={`現場写真 ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => handleSitePhotoRemove(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer w-full px-4 py-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">
              <span>📷</span>
              <span>現場写真を追加...</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleSitePhotoUpload(e.target.files)}
              />
            </label>
          </div>
        )}
      </div>

      {/* 戻る / 保存 */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={handleBack}
          className="px-8 py-4 bg-gray-100 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-200 transition"
        >
          ← 戻る
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-8 py-4 bg-green-600 text-white font-semibold text-base rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitting ? '保存中...' : (inspection ? '更新する' : '保存する')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-lg shadow max-w-4xl mx-auto">
      {/* フォームヘッダ */}
      <div className="px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-lg">
        <h2 className="text-xl font-bold text-gray-900">
          {inspection ? '点検を編集' : '新規点検を記録'}
        </h2>
      </div>

      {/* プログレスバー */}
      {/* ※ 内部定義の関数は JSX要素(<X/>)で呼ぶと毎レンダー再マウントされ
           入力欄のフォーカス/IME変換が壊れるため、関数として呼び出してJSXを展開する */}
      {ProgressBar()}

      {/* ステップコンテンツ */}
      {isBasicStep && StepBasic()}
      {isCategoryStep && StepCategory()}
      {isSummaryStep && StepSummary()}
    </div>
  )
}

export default InspectionForm
