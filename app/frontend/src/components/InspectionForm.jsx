import { useState, useEffect } from 'react'
import axios from 'axios'

const INSPECTION_CATEGORIES = [
  '一般事項',
  '建設機械',
  '機械装置',
  '仮設通路',
  '安全標識',
  '防具',
  '工具',
  '危険箇所',
]

function InspectionForm({ inspection, onSubmit }) {
  const [formData, setFormData] = useState({
    inspectionId: '',
    date: new Date().toISOString().split('T')[0],
    inspectorId: '',
    projectId: '',
    managerId: '',
    categories: [],
    comments: '',
    reportUrl: '',
    status: 'pending',
  })
  const [staff, setStaff] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)

  const getApiUrl = () => {
    const isDev = process.env.NODE_ENV !== 'production'
    return isDev ? 'http://localhost:3000' : 'https://portal-api-hhlx.onrender.com'
  }

  useEffect(() => {
    fetchMasterData()
  }, [])

  const fetchMasterData = async () => {
    try {
      setLoading(true)
      const [staffRes, projectsRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/masters/staff`),
        axios.get(`${getApiUrl()}/api/masters/projects`)
      ])
      setStaff(staffRes.data)
      setProjects(projectsRes.data)
    } catch (error) {
      console.error('Failed to fetch master data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (inspection) {
      setFormData(inspection)
    }
  }, [inspection])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCategoryChange = (category) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.inspectionId || !formData.inspectorId || !formData.projectId) {
      alert('必須項目を入力してください')
      return
    }
    onSubmit(formData)
  }

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {inspection ? '点検を編集' : '新規点検を記録'}
      </h2>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            点検ID *
          </label>
          <input
            type="text"
            name="inspectionId"
            placeholder="例: INS001"
            value={formData.inspectionId}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            点検日
          </label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            現場 *
          </label>
          <select
            name="projectId"
            value={formData.projectId}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">選択してください</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            検査員 *
          </label>
          <select
            name="inspectorId"
            value={formData.inspectorId}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">選択してください</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.id} - {s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            作業所長
          </label>
          <select
            name="managerId"
            value={formData.managerId}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">選択してください</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.id} - {s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ステータス
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="pending">未確認</option>
            <option value="approved">承認済み</option>
            <option value="rejected">要修正</option>
          </select>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          対象区分 ({formData.categories.length})
        </label>
        <div className="grid grid-cols-2 gap-3">
          {INSPECTION_CATEGORIES.map(category => (
            <label key={category} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData.categories.includes(category)}
                onChange={() => handleCategoryChange(category)}
                className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">{category}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          コメント・指摘事項
        </label>
        <textarea
          name="comments"
          placeholder="問題があれば記入してください"
          value={formData.comments}
          onChange={handleChange}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          報告書URL
        </label>
        <input
          type="url"
          name="reportUrl"
          placeholder="https://..."
          value={formData.reportUrl}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
        >
          {inspection ? '更新' : '保存'}
        </button>
      </div>
    </form>
  )
}

export default InspectionForm
