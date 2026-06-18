import { useState, useEffect } from 'react'
import axios from 'axios'
import InspectionForm from '../components/InspectionForm'
import InspectionList from '../components/InspectionList'
import InspectionDetail from '../components/InspectionDetail'
import CorrectionList from '../components/CorrectionList'
import { generateInspectionPdf } from '../lib/inspectionPdf'
import Button from '../components/ui/Button'
import ThemeToggle from '../components/ui/ThemeToggle'
import { ClipboardCheck, Plus, Wrench, Settings, LogOut, LayoutGrid } from 'lucide-react'
import { getApiUrl, authHeaders } from '../lib/api'

function DashboardPage({ user, onLogout, onBackToPortal, onOpenMasters }) {
  const [activeTab, setActiveTab] = useState('list')
  const [inspections, setInspections] = useState([])
  const [projects, setProjects] = useState([])
  const [staff, setStaff] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [pdfBusyId, setPdfBusyId] = useState(null)
  const [sendBusyId, setSendBusyId] = useState(null)
  // 権限: spRole=安全パトロールのアプリ内ロール（admin: 全機能 / member: 閲覧・新規点検）,
  //       role=ポータル全体のグローバルロール, staffId=本人のスタッフID
  const [perms, setPerms] = useState({ role: 'member', spRole: 'member', staffId: null })
  const isAdmin = perms.role === 'admin' || perms.spRole === 'admin'
  // 編集/PDF発行できるか（管理者は全件、メンバーは自分が検査官の案件のみ）
  const canEditInspection = (insp) => isAdmin || (!!perms.staffId && insp?.inspector_id === perms.staffId)

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s.name]))

  useEffect(() => {
    fetchInspections()
    fetchMasters()
    fetchPermissions()
  }, [])

  const fetchPermissions = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/my-permissions`, { headers: authHeaders() })
      setPerms({ role: res.data.role, spRole: res.data.safety_patrol_role, staffId: res.data.staff_id })
    } catch (error) {
      console.error('権限取得に失敗:', error)
      setPerms({ role: 'member', spRole: 'member', staffId: null }) // 取得失敗時は最小権限
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

  // タブ定義（ラベル・アイコンのみ。onClick/activeTab ロジックは下の JSX 内で維持）
  const TABS = [
    { id: 'list',        label: '点検一覧',  Icon: ClipboardCheck },
    { id: 'form',        label: '新規点検',  Icon: Plus           },
    { id: 'corrections', label: '是正対応',  Icon: Wrench         },
  ]

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-ink-950">

      {/* ─── スティッキーヘッダー ─── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-ink-800 border-b border-slate-200 dark:border-ink-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">

            {/* ブランドロゴ */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg leading-none">中</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-none hidden sm:block">中原建設</p>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  安全パトロール
                </h1>
              </div>
            </div>

            {/* 右側コントロール */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* ユーザー情報（中サイズ以上のみ） */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{user.email}</p>
              </div>

              {onBackToPortal && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onBackToPortal}
                  className="h-10 gap-1.5"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">ポータルに戻る</span>
                </Button>
              )}

              <ThemeToggle />

              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="h-10 gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">ログアウト</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── タブナビゲーション ─── */}
      <div className="sticky top-14 sm:top-16 z-20 bg-white dark:bg-ink-800 border-b border-slate-200 dark:border-ink-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">

          {/* タブ群 */}
          <div className="flex">
            {TABS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => {
                    if (id === 'list') {
                      setActiveTab('list')
                      setEditingId(null)
                      setViewingId(null)
                    } else if (id === 'form') {
                      setActiveTab('form')
                      setEditingId(null)
                      setViewingId(null)
                    } else {
                      setActiveTab('corrections')
                      setEditingId(null)
                      setViewingId(null)
                    }
                  }}
                  className={`
                    flex items-center gap-1.5 py-3 px-3 sm:px-5 text-sm font-semibold border-b-2 transition-colors
                    ${isActive
                      ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-ink-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          {/* マスター管理ボタン（管理者のみ） */}
          {onOpenMasters && isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenMasters}
              className="h-9 gap-1.5 flex-shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">マスター管理</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── メインコンテンツ ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
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
