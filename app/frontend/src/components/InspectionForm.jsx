import { useState, useEffect } from 'react'

const INSPECTION_ITEMS = [
  '安全標識の確認',
  '防具の確認',
  '工具の点検',
  '作業環境の確認',
  '危険箇所の確認',
  '緊急連絡体制の確認',
  'ヒヤリハット報告',
  '安全教育実施状況',
]

function InspectionForm({ inspection, onSubmit }) {
  const [formData, setFormData] = useState({
    inspectionId: '',
    date: new Date().toISOString().split('T')[0],
    inspectorName: '',
    location: '',
    checkedItems: {},
    issues: '',
    status: 'pending',
  })

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

  const handleCheckboxChange = (item) => {
    setFormData(prev => ({
      ...prev,
      checkedItems: {
        ...prev.checkedItems,
        [item]: !prev.checkedItems[item]
      }
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.inspectionId || !formData.inspectorName || !formData.location) {
      alert('必須項目を入力してください')
      return
    }
    onSubmit(formData)
  }

  const checkedCount = Object.values(formData.checkedItems).filter(Boolean).length

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto">
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
            placeholder="例: S007"
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
            検査員名 *
          </label>
          <input
            type="text"
            name="inspectorName"
            placeholder="名前を入力"
            value={formData.inspectorName}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            点検場所 *
          </label>
          <input
            type="text"
            name="location"
            placeholder="場所を入力"
            value={formData.location}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          点検項目 ({checkedCount}/{INSPECTION_ITEMS.length})
        </label>
        <div className="grid grid-cols-2 gap-3">
          {INSPECTION_ITEMS.map(item => (
            <label key={item} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData.checkedItems[item] || false}
                onChange={() => handleCheckboxChange(item)}
                className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">{item}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          指摘事項・備考
        </label>
        <textarea
          name="issues"
          placeholder="問題があれば記入してください"
          value={formData.issues}
          onChange={handleChange}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      <div className="mb-6">
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
