import { useState, useEffect } from 'react'
import axios from 'axios'

function MastersPage() {
  const [activeTab, setActiveTab] = useState('projects')
  const [projects, setProjects] = useState([])
  const [staff, setStaff] = useState([])
  const [inspectionItems, setInspectionItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({})

  const API_URL = process.env.NODE_ENV !== 'production'
    ? 'http://localhost:3000'
    : 'https://portal-api-hhlx.onrender.com'

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('authToken')}`
  })

  // データ取得
  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    try {
      setLoading(true)
      if (activeTab === 'projects') {
        const res = await axios.get(`${API_URL}/api/masters/projects`, { headers: authHeaders() })
        setProjects(res.data)
      } else if (activeTab === 'staff') {
        const res = await axios.get(`${API_URL}/api/masters/staff`, { headers: authHeaders() })
        setStaff(res.data)
      } else if (activeTab === 'inspection-items') {
        const res = await axios.get(`${API_URL}/api/masters/inspection-items`, { headers: authHeaders() })
        setInspectionItems(res.data)
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
      alert('データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const endpoint = `/api/masters/${activeTab}`
      const isNew = editingId === 'new'
      const method = isNew ? 'post' : 'put'
      const url = isNew ? endpoint : `${endpoint}/${editingId}`

      // 新規作成時は id を送らない（サーバー自動採番）
      const payload = isNew
        ? Object.fromEntries(Object.entries(formData).filter(([k]) => k !== 'id'))
        : formData

      await axios[method](`${API_URL}${url}`, payload, { headers: authHeaders() })
      alert(isNew ? '追加しました' : '更新しました')
      setFormData({})
      setEditingId(null)
      fetchData()
    } catch (error) {
      console.error('Save error:', error)
      alert('保存に失敗しました')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('削除してもいいですか？')) return
    try {
      const endpoint = `/api/masters/${activeTab}`
      await axios.delete(`${API_URL}${endpoint}/${id}`, { headers: authHeaders() })
      alert('削除しました')
      fetchData()
    } catch (error) {
      console.error('Delete error:', error)
      alert('削除に失敗しました')
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setFormData(item)
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({})
  }

  // 現場マスター表示
  const renderProjects = () => (
    <div className="space-y-4">
      {editingId && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">現場名</label>
              <input
                placeholder="○○現場"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在地</label>
              <input
                placeholder="東京都渋谷区"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              保存
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium">
              キャンセル
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setEditingId('new')
          setFormData({})
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-4"
      >
        ➕ 新規追加
      </button>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">現場名</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">所在地</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-600">{project.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{project.location}</td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(project)}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-red-600 hover:text-red-800 hover:underline font-medium"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // スタッフマスター表示
  const renderStaff = () => (
    <div className="space-y-4">
      {editingId && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
              <input
                placeholder="中原 釈統"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
              <input
                placeholder="tokimune@nakahara131.co.jp"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              保存
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium">
              キャンセル
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setEditingId('new')
          setFormData({})
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-4"
      >
        ➕ 新規追加
      </button>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">氏名</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">メールアドレス</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-600">{s.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{s.email}</td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(s)}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-red-600 hover:text-red-800 hover:underline font-medium"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  // 対象区分マスター表示
  const renderInspectionItems = () => (
    <div className="space-y-4">
      {editingId && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">区分</label>
              <input
                placeholder="一般事項"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">点検項目内容</label>
              <input
                placeholder="安全標識の確認"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              保存
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium">
              キャンセル
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setEditingId('new')
          setFormData({})
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium mb-4"
      >
        ➕ 新規追加
      </button>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">区分</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">点検項目内容</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inspectionItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.description}</td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:text-red-800 hover:underline font-medium"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚙️</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">マスター管理</h1>
              <p className="text-sm text-gray-500">現場、スタッフ、対象区分の設定</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* タブ */}
        <div className="bg-white rounded-t-lg border-b border-gray-200 shadow-sm">
          <div className="flex gap-8 px-6">
            {[
              { id: 'projects', label: '📍 現場' },
              { id: 'staff', label: '👤 社員' },
              { id: 'inspection-items', label: '📋 対象区分' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 font-medium text-sm border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* コンテンツ */}
        <div className="bg-white rounded-b-lg shadow-sm p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">読み込み中...</p>
            </div>
          ) : (
            <>
              {activeTab === 'projects' && renderProjects()}
              {activeTab === 'staff' && renderStaff()}
              {activeTab === 'inspection-items' && renderInspectionItems()}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default MastersPage
