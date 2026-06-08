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

  // ヘッダ項目の状態
  const [header, setHeader] = useState({
    inspection_date: today,
    project_id: '',
    inspector_id: '',
    manager_id: '',
    comments: '',
  })

  // マスタデータ
  const [staff, setStaff] = useState([])
  const [projects, setProjects] = useState([])
  const [inspectionItems, setInspectionItems] = useState([]) // { id, category, description }

  // 各 item_id に対する評価状態
  // { [item_id]: { result: '良'|'指摘あり', issue_content: '', issue_image_url: '', due_date: '', uploading: false } }
  const [itemStates, setItemStates] = useState({})

  const [masterLoading, setMasterLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // マスタ取得
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setMasterLoading(true)
        const [staffRes, projectsRes, itemsRes] = await Promise.all([
          axios.get(`${getApiUrl()}/api/masters/staff`, { headers: authHeaders() }),
          axios.get(`${getApiUrl()}/api/masters/projects`, { headers: authHeaders() }),
          axios.get(`${getApiUrl()}/api/masters/inspection-items`, { headers: authHeaders() }),
        ])
        setStaff(staffRes.data)
        setProjects(projectsRes.data)
        setInspectionItems(itemsRes.data)

        // itemStates を初期化（全件「良」）
        const init = {}
        for (const item of itemsRes.data) {
          init[item.id] = {
            result: '良',
            issue_content: '',
            issue_image_url: '',
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
      comments: inspection.comments || '',
    })
    // inspection_details があれば itemStates に反映
    if (inspection.inspection_details && inspection.inspection_details.length > 0) {
      setItemStates(prev => {
        const next = { ...prev }
        for (const d of inspection.inspection_details) {
          if (next[d.item_id] !== undefined) {
            next[d.item_id] = {
              result: d.result,
              issue_content: d.issue_content || '',
              issue_image_url: d.issue_image_url || '',
              due_date: d.due_date || plusDays(inspection.inspection_date || today, 7),
              uploading: false,
            }
          }
        }
        return next
      })
    }
  }, [inspection])

  // ヘッダ変更（点検日変更時は due_date のデフォルトも追随）
  const handleHeaderChange = (e) => {
    const { name, value } = e.target
    setHeader(prev => ({ ...prev, [name]: value }))
    if (name === 'inspection_date') {
      setItemStates(prev => {
        const next = { ...prev }
        for (const id in next) {
          // due_date がデフォルト値（前の点検日+7）のままなら追随させる
          // 手動変更済みは触らない → ここでは全件を新しい日付+7に更新
          next[id] = { ...next[id], due_date: plusDays(value, 7) }
        }
        return next
      })
    }
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

  // 写真アップロード
  const handlePhotoUpload = async (itemId, file) => {
    if (!file) return
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], uploading: true }
    }))
    try {
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
      setItemStates(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], issue_image_url: res.data.url, uploading: false }
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

  // 送信
  const handleSubmit = async (e) => {
    e.preventDefault()

    // バリデーション
    if (!header.project_id || !header.inspector_id) {
      alert('現場と検査員は必須です')
      return
    }
    // 指摘ありで内容未入力チェック
    for (const item of inspectionItems) {
      const st = itemStates[item.id]
      if (st && st.result === '指摘あり' && !st.issue_content.trim()) {
        alert(`「${item.description}」の指摘内容を入力してください`)
        return
      }
    }

    // details 組み立て
    const details = inspectionItems.map(item => {
      const st = itemStates[item.id] || { result: '良' }
      const base = {
        item_id: item.id,
        category: item.category,
        description: item.description,
        result: st.result,
      }
      if (st.result === '指摘あり') {
        base.issue_content = st.issue_content
        base.issue_image_url = st.issue_image_url || ''
        base.due_date = st.due_date
      }
      return base
    })

    // categories: 指摘ありが1件以上あったカテゴリ
    const issuedCategories = [
      ...new Set(
        inspectionItems
          .filter(item => itemStates[item.id]?.result === '指摘あり')
          .map(item => item.category)
      )
    ]

    const payload = {
      project_id: header.project_id,
      inspector_id: header.inspector_id,
      manager_id: header.manager_id || null,
      inspection_date: header.inspection_date,
      status: 'completed',
      comments: header.comments,
      categories: issuedCategories,
      details,
    }

    setSubmitting(true)
    try {
      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  // カテゴリ別グルーピング
  const grouped = inspectionItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  if (masterLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">マスタデータを読み込み中...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow max-w-4xl mx-auto">
      {/* フォームヘッダ */}
      <div className="px-6 py-4 border-b border-gray-200 bg-green-50 rounded-t-lg">
        <h2 className="text-xl font-bold text-gray-900">
          {inspection ? '点検を編集' : '新規点検を記録'}
        </h2>
      </div>

      <div className="p-6">
        {/* ヘッダ項目 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
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

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              コメント
            </label>
            <textarea
              name="comments"
              value={header.comments}
              onChange={handleHeaderChange}
              rows={2}
              placeholder="全体コメントがあれば入力"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
            />
          </div>
        </div>

        {/* 点検項目（カテゴリ別） */}
        {inspectionItems.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">点検項目マスタが登録されていません</p>
            <p className="text-gray-400 text-sm mt-1">マスター管理で項目を追加してください</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">点検項目</h3>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* カテゴリヘッダ */}
                <div className="bg-green-600 px-4 py-2">
                  <span className="text-white font-semibold text-sm">{category}</span>
                </div>
                {/* 項目リスト */}
                <div className="divide-y divide-gray-100">
                  {items.map(item => {
                    const st = itemStates[item.id] || { result: '良', issue_content: '', issue_image_url: '', due_date: '', uploading: false }
                    const isIssue = st.result === '指摘あり'
                    return (
                      <div key={item.id} className={`p-4 ${isIssue ? 'bg-red-50' : ''}`}>
                        {/* 項目名 + 評価トグル */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm text-gray-800 flex-1 min-w-0">{item.description}</span>
                          {/* セグメントボタン */}
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
                          <div className="mt-4 space-y-3 pl-0 sm:pl-4">
                            {/* 指摘内容 */}
                            <div>
                              <label className="block text-xs font-medium text-red-700 mb-1">
                                指摘内容 <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                value={st.issue_content}
                                onChange={e => handleIssueChange(item.id, 'issue_content', e.target.value)}
                                rows={2}
                                placeholder="指摘内容を入力してください"
                                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm"
                              />
                            </div>

                            {/* 写真アップロード */}
                            <div>
                              <label className="block text-xs font-medium text-red-700 mb-1">指摘写真</label>
                              {st.uploading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-green-600 rounded-full animate-spin"></span>
                                  アップロード中...
                                </div>
                              ) : st.issue_image_url ? (
                                <div className="flex items-center gap-3">
                                  <img
                                    src={st.issue_image_url}
                                    alt="指摘写真"
                                    className="w-20 h-20 object-cover rounded border border-gray-300"
                                  />
                                  <label className="cursor-pointer text-xs text-blue-600 underline">
                                    変更
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={e => handlePhotoUpload(item.id, e.target.files[0])}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <label className="flex items-center gap-2 cursor-pointer w-full px-3 py-2 border border-dashed border-red-300 rounded-lg text-sm text-gray-500 hover:bg-red-50 transition">
                                  <span>📷</span>
                                  <span>写真を選択...</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => handlePhotoUpload(item.id, e.target.files[0])}
                                  />
                                </label>
                              )}
                            </div>

                            {/* 改善期限 */}
                            <div>
                              <label className="block text-xs font-medium text-red-700 mb-1">
                                改善期限（デフォルト: 点検日+7日）
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
              </div>
            ))}
          </div>
        )}

        {/* 送信ボタン */}
        <div className="mt-8 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 sm:flex-none px-8 py-4 bg-green-600 text-white font-semibold text-base rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? '保存中...' : (inspection ? '更新する' : '保存する')}
          </button>
        </div>
      </div>
    </form>
  )
}

export default InspectionForm
