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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  // データ取得
  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    try {
      setLoading(true)
      if (activeTab === 'projects') {
        const res = await axios.get(`${API_URL}/api/masters/projects`)
        setProjects(res.data)
      } else if (activeTab === 'staff') {
        const res = await axios.get(`${API_URL}/api/masters/staff`)
        setStaff(res.data)
      } else if (activeTab === 'inspection-items') {
        const res = await axios.get(`${API_URL}/api/masters/inspection-items`)
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
      const method = editingId ? 'put' : 'post'
      const url = editingId ? `${endpoint}/${editingId}` : endpoint

      await axios[method](`${API_URL}${url}`, formData)
      alert(editingId ? '更新しました' : '追加しました')
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
      await axios.delete(`${API_URL}${endpoint}/${id}`)
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
        <div className="bg-blue-50 p-4 rounded-lg space-y-3">
          <input
            placeholder="現場ID"
            value={formData.id || ''}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            disabled={editingId}
          />
          <input
            placeholder="現場名"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            placeholder="場所"
            value={formData.location || ''}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">
              保存
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-400 text-white rounded">
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
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        ➕ 追加
      </button>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">現場ID</th>
            <th className="border p-2">現場名</th>
            <th className="border p-2">場所</th>
            <th className="border p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="border p-2">{project.id}</td>
              <td className="border p-2">{project.name}</td>
              <td className="border p-2">{project.location}</td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleEdit(project)}
                  className="text-blue-600 hover:underline"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="text-red-600 hover:underline"
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // スタッフマスター表示
  const renderStaff = () => (
    <div className="space-y-4">
      {editingId && (
        <div className="bg-blue-50 p-4 rounded-lg space-y-3">
          <input
            placeholder="スタッフID"
            value={formData.id || ''}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            disabled={editingId !== 'new'}
          />
          <input
            placeholder="名前"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            placeholder="メール"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            placeholder="役職"
            value={formData.role || ''}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">
              保存
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-400 text-white rounded">
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
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        ➕ 追加
      </button>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">スタッフID</th>
            <th className="border p-2">名前</th>
            <th className="border p-2">メール</th>
            <th className="border p-2">役職</th>
            <th className="border p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <td className="border p-2">{s.id}</td>
              <td className="border p-2">{s.name}</td>
              <td className="border p-2">{s.email}</td>
              <td className="border p-2">{s.role}</td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleEdit(s)}
                  className="text-blue-600 hover:underline"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-red-600 hover:underline"
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // 対象区分マスター表示
  const renderInspectionItems = () => (
    <div className="space-y-4">
      {editingId && (
        <div className="bg-blue-50 p-4 rounded-lg space-y-3">
          <input
            placeholder="項目ID"
            value={formData.id || ''}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            disabled={editingId !== 'new'}
          />
          <input
            placeholder="カテゴリ"
            value={formData.category || ''}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <input
            placeholder="説明"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">
              保存
            </button>
            <button onClick={handleCancel} className="px-4 py-2 bg-gray-400 text-white rounded">
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
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        ➕ 追加
      </button>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">項目ID</th>
            <th className="border p-2">カテゴリ</th>
            <th className="border p-2">説明</th>
            <th className="border p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {inspectionItems.map((item) => (
            <tr key={item.id}>
              <td className="border p-2">{item.id}</td>
              <td className="border p-2">{item.category}</td>
              <td className="border p-2">{item.description}</td>
              <td className="border p-2 space-x-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="text-blue-600 hover:underline"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:underline"
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">⚙️ マスター管理</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* タブ */}
        <div className="flex gap-4 mb-6 border-b">
          {[
            { id: 'projects', label: '📍 現場' },
            { id: 'staff', label: '👤 スタッフ' },
            { id: 'inspection-items', label: '📋 対象区分' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-4 font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="bg-white rounded-lg shadow p-6">
          {loading ? (
            <p className="text-gray-500">読み込み中...</p>
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
