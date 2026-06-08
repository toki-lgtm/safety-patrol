import { useState, useEffect } from 'react'
import axios from 'axios'
import InspectionForm from '../components/InspectionForm'
import InspectionList from '../components/InspectionList'
import InspectionDetail from '../components/InspectionDetail'

function DashboardPage({ user, onLogout, onOpenMasters }) {
  const [activeTab, setActiveTab] = useState('list')
  const [inspections, setInspections] = useState([])
  const [projects, setProjects] = useState([])
  const [staff, setStaff] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [viewingId, setViewingId] = useState(null)

  const getApiUrl = () => {
    const isDev = process.env.NODE_ENV !== 'production'
    return isDev ? 'http://localhost:3000' : 'https://portal-api-hhlx.onrender.com'
  }

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('authToken')}`
  })

  useEffect(() => {
    fetchInspections()
    fetchMasters()
  }, [])

  const fetchMasters = async () => {
    try {
      const [projectsRes, staffRes] = await Promise.all([
        axios.get(`${getApiUrl()}/api/masters/projects`, { headers: authHeaders() }),
        axios.get(`${getApiUrl()}/api/masters/staff`, { headers: authHeaders() })
      ])
      setProjects(projectsRes.data)
      setStaff(staffRes.data)
    } catch (error) {
      console.error('Failed to fetch masters:', error)
    }
  }

  const fetchInspections = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(
        `${getApiUrl()}/api/inspections`,
        { headers: authHeaders() }
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
        `${getApiUrl()}/api/inspections`,
        data,
        { headers: authHeaders() }
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
        `${getApiUrl()}/api/inspections/${id}`,
        data,
        { headers: authHeaders() }
      )
      setInspections(
        inspections.map(insp => insp.id === id ? response.data : insp)
      )
      setEditingId(null)
      setActiveTab('list')
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
        `${getApiUrl()}/api/inspections/${id}`,
        { headers: authHeaders() }
      )
      setInspections(inspections.filter(insp => insp.id !== id))
      alert('削除しました')
    } catch (error) {
      console.error('Failed to delete inspection:', error)
      alert('削除に失敗しました')
    }
  }

  const handleViewInspection = (id) => {
    setViewingId(id)
  }

  const handleBackFromDetail = () => {
    setViewingId(null)
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
                setViewingId(null)
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
                setViewingId(null)
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
          viewingId ? (
            <InspectionDetail
              inspectionId={viewingId}
              onBack={handleBackFromDetail}
              projects={projects}
              staff={staff}
            />
          ) : (
            <InspectionList
              inspections={inspections}
              isLoading={isLoading}
              onView={handleViewInspection}
              onEdit={(id) => {
                setEditingId(id)
                setActiveTab('form')
              }}
              onDelete={handleDeleteInspection}
              projects={projects}
              staff={staff}
            />
          )
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
