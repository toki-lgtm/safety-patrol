import { useState, useEffect } from 'react'
import axios from 'axios'
import InspectionForm from '../components/InspectionForm'
import InspectionList from '../components/InspectionList'

function DashboardPage({ user, onLogout, onOpenMasters }) {
  const [activeTab, setActiveTab] = useState('list')
  const [inspections, setInspections] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    fetchInspections()
  }, [])

  const fetchInspections = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/inspections`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      )
      setInspections(response.data)
    } catch (error) {
      console.error('Failed to fetch inspections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddInspection = async (data) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/inspections`,
        data,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      )
      setInspections([response.data, ...inspections])
      setActiveTab('list')
      alert('点検を保存しました')
    } catch (error) {
      console.error('Failed to save inspection:', error)
      alert('保存に失敗しました')
    }
  }

  const handleUpdateInspection = async (id, data) => {
    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/inspections/${id}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      )
      setInspections(
        inspections.map(insp => insp.id === id ? response.data : insp)
      )
      setEditingId(null)
      alert('点検を更新しました')
    } catch (error) {
      console.error('Failed to update inspection:', error)
      alert('更新に失敗しました')
    }
  }

  const handleDeleteInspection = async (id) => {
    if (!confirm('本当に削除しますか？')) return

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/inspections/${id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      )
      setInspections(inspections.filter(insp => insp.id !== id))
      alert('削除しました')
    } catch (error) {
      console.error('Failed to delete inspection:', error)
      alert('削除に失敗しました')
    }
  }

  const editingInspection = editingId ? inspections.find(i => i.id === editingId) : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🛡️</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">安全パトロール</h1>
                <p className="text-sm text-gray-500">月次点検アプリ</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* タブ */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex gap-8">
            <button
              onClick={() => {
                setActiveTab('list')
                setEditingId(null)
              }}
              className={`py-4 px-2 font-medium text-sm border-b-2 transition ${
                activeTab === 'list'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 点検一覧
            </button>
            <button
              onClick={() => {
                setActiveTab('form')
                setEditingId(null)
              }}
              className={`py-4 px-2 font-medium text-sm border-b-2 transition ${
                activeTab === 'form'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              ➕ 新規点検
            </button>
          </div>
          {onOpenMasters && (
            <button
              onClick={onOpenMasters}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
            >
              ⚙️ マスター管理
            </button>
          )}
        </div>
      </div>

      {/* コンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'list' ? (
          <InspectionList
            inspections={inspections}
            isLoading={isLoading}
            onEdit={(id) => {
              setEditingId(id)
              setActiveTab('form')
            }}
            onDelete={handleDeleteInspection}
          />
        ) : (
          <InspectionForm
            inspection={editingInspection}
            onSubmit={(data) => {
              if (editingInspection) {
                handleUpdateInspection(editingInspection.id, data)
              } else {
                handleAddInspection(data)
              }
            }}
          />
        )}
      </main>
    </div>
  )
}

export default DashboardPage
