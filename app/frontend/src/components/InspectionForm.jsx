import { useState, useEffect } from 'react'
import axios from 'axios'
import Button from './ui/Button'
import Card from './ui/Card'
import { Check, X, Camera, ChevronRight, ChevronLeft, Save, MapPin } from 'lucide-react'

function InspectionForm({ inspection, onSubmit, isAdmin = false, myStaffId = null }) {
  // メンバーは検査員を自分に固定（管理者は自由選択）
  const lockInspector = !isAdmin && !!myStaffId
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

  // メンバーの新規点検は検査員を自分に固定
  useEffect(() => {
    if (lockInspector && !inspection) {
      setHeader(prev => ({ ...prev, inspector_id: myStaffId }))
    }
  }, [lockInspector, myStaffId, inspection])

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
      <div className="text-center py-16">
        <div className="inline-block w-10 h-10 border-4 border-slate-200 dark:border-ink-700 border-t-brand-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-base">マスタデータを読み込み中...</p>
      </div>
    )
  }

  // ---- プログレスバー ----
  const ProgressBar = () => (
    <div className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-ink-700">
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
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
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-all ${
                  isDone
                    ? 'bg-success-600 border-success-600 text-white'
                    : isCurrent
                    ? 'bg-white dark:bg-ink-800 border-brand-600 text-brand-600'
                    : 'bg-white dark:bg-ink-800 border-slate-300 dark:border-ink-600 text-slate-400 dark:text-slate-500'
                }`}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : idx + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isCurrent
                    ? 'text-brand-700 dark:text-brand-400 font-semibold'
                    : isDone
                    ? 'text-success-600 dark:text-success-500'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {label}
              </span>
              {idx < steps.length - 1 && (
                <div className={`w-4 h-0.5 mx-1 rounded-full transition-all ${idx < currentStep ? 'bg-success-500' : 'bg-slate-200 dark:bg-ink-600'}`} />
              )}
            </div>
          )
        })}
      </div>
      {/* 全体進捗バー */}
      <div className="mt-3 h-1 bg-slate-100 dark:bg-ink-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-300"
          style={{ width: `${totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0}%` }}
        />
      </div>
    </div>
  )

  // ---- Step 1: 基本情報 ----
  const inputBase = 'w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-ink-600 bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/30 focus:outline-none text-base transition'
  const labelBase = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'

  const StepBasic = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-ink-700">
        <MapPin size={18} className="text-brand-600 dark:text-brand-400 flex-shrink-0" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">基本情報</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelBase}>
            点検日 <span className="text-danger-500">*</span>
          </label>
          <input
            type="date"
            name="inspection_date"
            value={header.inspection_date}
            onChange={handleHeaderChange}
            className={inputBase}
          />
        </div>

        <div>
          <label className={labelBase}>
            現場 <span className="text-danger-500">*</span>
          </label>
          <select
            name="project_id"
            value={header.project_id}
            onChange={handleHeaderChange}
            className={inputBase}
          >
            <option value="">選択してください</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelBase}>
            検査員 <span className="text-danger-500">*</span>
          </label>
          <select
            name="inspector_id"
            value={header.inspector_id}
            onChange={handleHeaderChange}
            disabled={lockInspector}
            className={`${inputBase} ${lockInspector ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <option value="">選択してください</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {lockInspector && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">あなたが検査員として記録されます（変更不可）</p>
          )}
        </div>

        <div>
          <label className={labelBase}>
            作業所長
          </label>
          <select
            name="manager_id"
            value={header.manager_id}
            onChange={handleHeaderChange}
            className={inputBase}
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
        <label className={labelBase}>
          対象区分 <span className="text-danger-500">*</span>
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-normal">（1つ以上選択してください）</span>
        </label>
        {allCategories.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-sm">カテゴリマスタが登録されていません</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allCategories.map(cat => {
              const checked = selectedCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryToggle(cat)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left min-h-[48px] ${
                    checked
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300'
                      : 'border-slate-200 dark:border-ink-600 bg-white dark:bg-ink-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-ink-500 hover:bg-slate-50 dark:hover:bg-ink-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                    checked
                      ? 'bg-brand-600 border-brand-600'
                      : 'border-slate-300 dark:border-ink-500'
                  }`}>
                    {checked && <Check size={12} strokeWidth={3} className="text-white" />}
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
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleNextFromBasic}
          className="gap-2 h-12"
        >
          次へ
          <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  )

  // ---- Step 2〜N: カテゴリ別詳細点検 ----
  const StepCategory = () => (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-ink-700">
        <span className="px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 text-xs font-semibold flex-shrink-0">
          {categoryStepIndex + 2} / {totalSteps - 1}
        </span>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{currentStepName}</h3>
      </div>

      {currentItems.length === 0 ? (
        <p className="text-slate-400 dark:text-slate-500 text-sm py-4">このカテゴリに点検項目がありません</p>
      ) : (
        <div className="space-y-3">
          {currentItems.map((item, itemIdx) => {
            const st = itemStates[item.id] || {
              result: '良',
              issue_content: '',
              issue_image_urls: [],
              due_date: plusDays(header.inspection_date, 7),
              uploading: false,
            }
            const isIssue = st.result === '指摘あり'
            return (
              <Card
                key={item.id}
                className={`overflow-hidden transition-all ${
                  isIssue
                    ? 'border-danger-300 dark:border-danger-500/40'
                    : 'border-slate-200 dark:border-ink-700'
                }`}
              >
                {/* 項目番号バー */}
                <div className={`px-4 pt-3 pb-2 flex items-start gap-3 ${isIssue ? 'bg-danger-50 dark:bg-danger-500/10' : ''}`}>
                  <span className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isIssue
                      ? 'bg-danger-600 text-white'
                      : 'bg-slate-200 dark:bg-ink-600 text-slate-500 dark:text-slate-400'
                  }`}>
                    {itemIdx + 1}
                  </span>
                  <span className="text-sm text-slate-800 dark:text-slate-200 flex-1 min-w-0 pt-0.5 leading-relaxed">
                    {item.description}
                  </span>
                </div>

                {/* 合 / 指摘あり トグルボタン（現場でタップしやすい大きめサイズ） */}
                <div className="px-4 pb-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleResultToggle(item.id, '良')}
                    className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      !isIssue
                        ? 'bg-success-600 border-success-600 text-white shadow-sm'
                        : 'bg-white dark:bg-ink-700 border-slate-300 dark:border-ink-600 text-slate-500 dark:text-slate-400 hover:border-success-400 hover:bg-success-50 dark:hover:bg-success-500/10'
                    }`}
                  >
                    <Check size={16} strokeWidth={3} />
                    合
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResultToggle(item.id, '指摘あり')}
                    className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      isIssue
                        ? 'bg-danger-600 border-danger-600 text-white shadow-sm'
                        : 'bg-white dark:bg-ink-700 border-slate-300 dark:border-ink-600 text-slate-500 dark:text-slate-400 hover:border-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10'
                    }`}
                  >
                    <X size={16} strokeWidth={3} />
                    不合
                  </button>
                </div>

                {/* 指摘あり展開エリア */}
                {isIssue && (
                  <div className="mx-4 mb-4 space-y-4 p-4 bg-danger-50 dark:bg-danger-500/10 rounded-xl border border-danger-200 dark:border-danger-500/30">
                    {/* 指摘内容 */}
                    <div>
                      <label className="block text-xs font-semibold text-danger-700 dark:text-danger-400 mb-1.5">
                        指摘内容 <span className="text-danger-500">*</span>
                      </label>

                      {/* 過去の指摘内容から選択（同じ項目で過去に入力したもの）。クリックで下の入力欄に反映 */}
                      {(issueTemplates[item.id]?.length > 0) && (
                        <div className="mb-2">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">よく使う指摘内容（タップで入力）</p>
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
                                      ? 'bg-danger-600 border-danger-600 text-white'
                                      : 'bg-white dark:bg-ink-700 border-danger-300 dark:border-danger-500/40 text-danger-700 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-500/20'
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
                        className="w-full px-3 py-3 rounded-xl border border-danger-300 dark:border-danger-500/40 bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-100 focus:border-danger-500 focus:ring-2 focus:ring-danger-100 dark:focus:ring-danger-500/20 focus:outline-none text-sm transition"
                      />
                    </div>

                    {/* 指摘写真（複数枚） */}
                    <div>
                      <label className="block text-xs font-semibold text-danger-700 dark:text-danger-400 mb-1.5">指摘写真（複数可）</label>
                      {st.uploading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
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
                                    className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-ink-600"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoRemove(item.id, idx)}
                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-danger-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-danger-600 transition shadow"
                                  >
                                    <X size={12} strokeWidth={3} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* 追加ボタン */}
                          <label className="flex items-center gap-2 cursor-pointer w-full px-3 py-2.5 border border-dashed border-danger-300 dark:border-danger-500/40 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition">
                            <Camera size={16} className="text-danger-500 dark:text-danger-400 flex-shrink-0" />
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
                      <label className="block text-xs font-semibold text-danger-700 dark:text-danger-400 mb-1.5">
                        改善期限（既定: 点検日+7日）
                      </label>
                      <input
                        type="date"
                        value={st.due_date}
                        onChange={e => handleIssueChange(item.id, 'due_date', e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-danger-300 dark:border-danger-500/40 bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-100 focus:border-danger-500 focus:ring-2 focus:ring-danger-100 dark:focus:ring-danger-500/20 focus:outline-none text-sm transition"
                      />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* 戻る / 次へ */}
      <div className="flex justify-between pt-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleBack}
          className="gap-2 h-12"
        >
          <ChevronLeft size={18} />
          戻る
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleNextFromCategory}
          className="gap-2 h-12"
        >
          次へ
          <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  )

  // ---- 最終ステップ: まとめ ----
  const StepSummary = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-ink-700">
        <Save size={18} className="text-brand-600 dark:text-brand-400 flex-shrink-0" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">まとめ</h3>
      </div>

      {/* コメント */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          コメント（任意）
        </label>
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          rows={3}
          placeholder="全体コメントがあれば入力"
          className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-ink-600 bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/30 focus:outline-none text-base transition"
        />
      </div>

      {/* 現場写真（複数枚） */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          現場写真（複数可）
        </label>
        {sitePhotoUploading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></span>
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
                      className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-ink-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleSitePhotoRemove(idx)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-danger-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-danger-600 transition shadow"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer w-full px-4 py-3 border border-dashed border-slate-300 dark:border-ink-600 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-ink-700 transition">
              <Camera size={16} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
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
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleBack}
          className="gap-2 h-12"
        >
          <ChevronLeft size={18} />
          戻る
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
          className="gap-2 h-12"
        >
          <Save size={18} />
          {submitting ? '保存中...' : (inspection ? '更新する' : '保存する')}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="bg-white dark:bg-ink-800 rounded-2xl border border-slate-200 dark:border-ink-700 shadow-sm max-w-4xl mx-auto">
      {/* フォームヘッダ */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-ink-700 bg-brand-50 dark:bg-brand-500/10 rounded-t-2xl">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
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
