import { useState, useEffect } from 'react'
import axios from 'axios'
import InspectionForm from '../components/InspectionForm'
import InspectionList from '../components/InspectionList'
import InspectionDetail from '../components/InspectionDetail'
import CorrectionList from '../components/CorrectionList'
import { generateInspectionPdf } from '../lib/inspectionPdf'

function DashboardPage({ user, onLogout, onOpenMasters }) {
  const [activeTab, setActiveTab] = useState('list')
  const [inspections, setInspections] = useState([])
  const [projects, setProjects] = useState([])
  const [staff, setStaff] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [pdfBusyId, setPdfBusyId] = useState(null)
  const [sendBusyId, setSendBusyId] = useState(null)
  // 権限: role='admin'(全機能) / 'member'(閲覧・新規点検), staffId=本人のスタッフID
  const [perms, setPerms] = useState({ role: 'member', staffId: null })
  const isAdmin = perms.role === 'admin'
  // 編集/PDF発行できるか（管理者は全件、メンバーは自分が検査官の案件のみ）
  const canEditInspection = (insp) => isAdmin || (!!perms.staffId && insp?.inspector_id === perms.staffId)

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s.name]))

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
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/my-permissions`, { headers: authHeaders() })
      setPerms({ role: res.data.role, staffId: res.data.staff_id })
    } catch (error) {
      console.error('権限取得に失敗:', error)
      setPerms({ role: 'member', staffId: null }) // 取得失敗時は最小権限
    }
  }

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
      alert(error.response?.data?.error || '更新に失敗しました')
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
      alert(error.response?.data?.error || '削除に失敗しました')
    }
  }

  const handleViewInspection = (id) => {
    setViewingId(id)
  }

  const handleBackFromDetail = () => {
    setViewingId(null)
  }

  const handleEditInspection = (id) => {
    const target = inspections.find(i => i.id === id)
    if (target && !canEditInspection(target)) {
      alert('自分が検査した案件のみ編集できます')
      return
    }
    if (target && target.report_url) {
      alert('この点検はPDF生成済みのため編集できません')
      return
    }
    setEditingId(id)
    setViewingId(null)
    setActiveTab('form')
  }

  // PDFを生成 → 非公開ストレージへ保存 → 編集ロック。更新後の点検データを返す。
  const generatePdfForInspection = async (fullInspection) => {
    const { blob, filename } = await generateInspectionPdf(fullInspection, { projectMap, staffMap })
    const form = new FormData()
    form.append('report', blob, filename)
    const res = await axios.post(
      `${getApiUrl()}/api/inspections/${fullInspection.id}/report`,
      form,
      { headers: authHeaders() } // multipart 境界はブラウザが自動設定
    )
    const updated = res.data
    setInspections(prev => prev.map(insp => insp.id === updated.id ? { ...insp, ...updated } : insp))
    return updated
  }

  // 一覧からのPDF生成: 明細を含む完全データを取得してから生成・保存
  const handleGeneratePdfFromList = async (id) => {
    if (pdfBusyId) return
    try {
      setPdfBusyId(id)
      const res = await axios.get(
        `${getApiUrl()}/api/inspections/${id}`,
        { headers: authHeaders() }
      )
      await generatePdfForInspection(res.data)
      alert('PDFを生成・保存しました。「PDF表示」からいつでも閲覧できます。この点検は編集できなくなります。')
    } catch (error) {
      console.error('PDF生成に失敗:', error)
      alert(error.response?.data?.error || 'PDF生成に失敗しました')
    } finally {
      setPdfBusyId(null)
    }
  }

  // 保存済みPDFを表示（署名付きURLをアプリ越しに取得して新規タブで開く）
  const handleViewPdf = async (id) => {
    const win = window.open('', '_blank') // クリック直後に開いてポップアップブロック回避
    try {
      const res = await axios.get(
        `${getApiUrl()}/api/inspections/${id}/report-url`,
        { headers: authHeaders() }
      )
      if (win) win.location = res.data.url
      else window.open(res.data.url, '_blank')
    } catch (error) {
      console.error('PDF表示に失敗:', error)
      if (win) win.close()
      alert('PDFの表示に失敗しました')
    }
  }

  // 生成済みPDFを作業所長へメール送信（CC＝レポートCC対象の社員）。送信後 report_sent_at を返す。
  const handleSendReport = async (id) => {
    if (sendBusyId) return null
    const target = inspections.find(i => i.id === id)
    const confirmMsg = target?.report_sent_at
      ? 'この点検報告を作業所長へ再送信します。よろしいですか？'
      : '点検報告PDFを作業所長へメール送信します。\n（社員管理で「レポートCC対象」に設定した社員にもCCで送られます）\n\nよろしいですか？'
    if (!confirm(confirmMsg)) return null
    try {
      setSendBusyId(id)
      const res = await axios.post(
        `${getApiUrl()}/api/inspections/${id}/send-report`,
        {},
        { headers: authHeaders() }
      )
      const { to, cc, sent_at } = res.data
      setInspections(prev => prev.map(insp => insp.id === id ? { ...insp, report_sent_at: sent_at } : insp))
      const ccLine = cc && cc.length ? `\nCC: ${cc.join(', ')}` : ''
      alert(`メールを送信しました。\n宛先: ${to}${ccLine}`)
      return { report_sent_at: sent_at }
    } catch (error) {
      console.error('メール送信に失敗:', error)
      alert(error.response?.data?.error || 'メール送信に失敗しました')
      throw error
    } finally {
      setSendBusyId(null)
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
            <button
              onClick={() => {
                setActiveTab('corrections')
                setEditingId(null)
                setViewingId(null)
              }}
              className={`py-4 px-2 font-medium text-sm border-b-2 transition ${
                activeTab === 'corrections'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🔧 是正対応
            </button>
          </div>
          {onOpenMasters && isAdmin && (
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
        {activeTab === 'corrections' ? (
          <CorrectionList
            projects={projects}
            staff={staff}
            isAdmin={isAdmin}
            myStaffId={perms.staffId}
          />
        ) : activeTab === 'list' ? (
          viewingId ? (
            <InspectionDetail
              inspectionId={viewingId}
              onBack={handleBackFromDetail}
              onEdit={handleEditInspection}
              onGeneratePdf={generatePdfForInspection}
              onViewPdf={handleViewPdf}
              onSendReport={handleSendReport}
              sendBusyId={sendBusyId}
              projects={projects}
              staff={staff}
              isAdmin={isAdmin}
              myStaffId={perms.staffId}
            />
          ) : (
            <InspectionList
              inspections={inspections}
              isLoading={isLoading}
              onView={handleViewInspection}
              onEdit={handleEditInspection}
              onDelete={handleDeleteInspection}
              onGeneratePdf={handleGeneratePdfFromList}
              onViewPdf={handleViewPdf}
              onSendReport={handleSendReport}
              sendBusyId={sendBusyId}
              pdfBusyId={pdfBusyId}
              projects={projects}
              staff={staff}
              isAdmin={isAdmin}
              myStaffId={perms.staffId}
            />
          )
        ) : (
          <InspectionForm
            inspection={editingInspection}
            isAdmin={isAdmin}
            myStaffId={perms.staffId}
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
