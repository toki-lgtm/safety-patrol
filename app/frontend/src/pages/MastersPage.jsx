import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Pencil, Trash2, Building2, Users, ListChecks, Save, X, Mail } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

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

  // 入力欄の共通クラス
  const inputClass =
    'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-ink-600 bg-white dark:bg-ink-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition'

  const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5'

  // 編集フォームラッパー
  const FormPanel = ({ children }) => (
    <Card className="p-5 sm:p-6 mb-6 border-brand-200 dark:border-brand-700/50 bg-brand-50/40 dark:bg-brand-900/10">
      <div className="space-y-4">
        {children}
      </div>
    </Card>
  )

  // 操作ボタン列（編集・削除）
  const ActionButtons = ({ onEdit, onDelete }) => (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={onEdit}
      >
        <Pencil size={14} />
        編集
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={onDelete}
      >
        <Trash2 size={14} />
        削除
      </Button>
    </div>
  )

  // テーブル共通スタイル
  const thClass = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
  const tdClass = 'px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300'

  // 現場マスター表示
  const renderProjects = () => (
    <div className="space-y-4">
      {editingId && (
        <FormPanel>
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-3">
            {editingId === 'new' ? '新規現場を追加' : '現場情報を編集'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>現場名</label>
              <input
                placeholder="○○現場"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>所在地</label>
              <input
                placeholder="東京都渋谷区"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="md" onClick={handleSave}>
              <Save size={15} />
              保存
            </Button>
            <Button variant="ghost" size="md" onClick={handleCancel}>
              <X size={15} />
              キャンセル
            </Button>
          </div>
        </FormPanel>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {projects.length} 件登録中
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditingId('new')
            setFormData({})
          }}
        >
          <Plus size={16} />
          新規追加
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-ink-700/50 border-b border-slate-200 dark:border-ink-700">
              <tr>
                <th className={thClass}>現場名</th>
                <th className={thClass}>所在地</th>
                <th className={thClass + ' text-right'}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    登録されている現場がありません
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-ink-700/50 transition-colors">
                    <td className={tdClass + ' font-medium text-slate-900 dark:text-white'}>
                      {project.name}
                    </td>
                    <td className={tdClass}>{project.location}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionButtons
                        onEdit={() => handleEdit(project)}
                        onDelete={() => handleDelete(project.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  // スタッフマスター表示
  const renderStaff = () => (
    <div className="space-y-4">
      {editingId && (
        <FormPanel>
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-3">
            {editingId === 'new' ? '新規スタッフを追加' : 'スタッフ情報を編集'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>氏名</label>
              <input
                placeholder="中原 釈統"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>メールアドレス</label>
              <input
                placeholder="tokimune@nakahara131.co.jp"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                ログイン中のGoogleアカウントと一致させると本人の点検が紐づきます
              </p>
            </div>
            <div>
              <label className={labelClass}>権限</label>
              <select
                value={formData.app_role || 'member'}
                onChange={(e) => setFormData({ ...formData, app_role: e.target.value })}
                className={inputClass}
              >
                <option value="member">メンバー（一覧閲覧・新規点検）</option>
                <option value="admin">管理者（全機能）</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-3 cursor-pointer select-none min-h-[44px]">
                <input
                  type="checkbox"
                  checked={!!formData.report_cc}
                  onChange={(e) => setFormData({ ...formData, report_cc: e.target.checked })}
                  className="w-5 h-5 rounded text-brand-600 border-slate-300 dark:border-ink-600 focus:ring-2 focus:ring-brand-500/20 bg-white dark:bg-ink-700 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail size={14} className="text-brand-500" />
                  レポートメールのCCに追加
                </span>
              </label>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-ink-700/50 rounded-lg px-3 py-2">
            ※ チェックすると、点検報告PDFのメール送信時にこの社員が常にCCに入ります（宛先は各現場の作業所長）。
          </p>
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="md" onClick={handleSave}>
              <Save size={15} />
              保存
            </Button>
            <Button variant="ghost" size="md" onClick={handleCancel}>
              <X size={15} />
              キャンセル
            </Button>
          </div>
        </FormPanel>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {staff.length} 件登録中
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditingId('new')
            setFormData({})
          }}
        >
          <Plus size={16} />
          新規追加
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-ink-700/50 border-b border-slate-200 dark:border-ink-700">
              <tr>
                <th className={thClass}>氏名</th>
                <th className={thClass}>メールアドレス</th>
                <th className={thClass}>権限</th>
                <th className={thClass}>レポートCC</th>
                <th className={thClass + ' text-right'}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    登録されているスタッフがありません
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-ink-700/50 transition-colors">
                    <td className={tdClass + ' font-medium text-slate-900 dark:text-white'}>
                      {s.name}
                    </td>
                    <td className={tdClass}>{s.email}</td>
                    <td className="px-4 py-3.5">
                      {s.app_role === 'admin' ? (
                        <Badge tone="info">管理者</Badge>
                      ) : (
                        <Badge tone="neutral">メンバー</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {s.report_cc ? (
                        <Badge tone="success">
                          <Mail size={11} />
                          CC対象
                        </Badge>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionButtons
                        onEdit={() => handleEdit(s)}
                        onDelete={() => handleDelete(s.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  // 対象区分マスター表示
  const renderInspectionItems = () => (
    <div className="space-y-4">
      {editingId && (
        <FormPanel>
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300 mb-3">
            {editingId === 'new' ? '新規対象区分を追加' : '対象区分を編集'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>区分</label>
              <input
                placeholder="一般事項"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>点検項目内容</label>
              <input
                placeholder="安全標識の確認"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="md" onClick={handleSave}>
              <Save size={15} />
              保存
            </Button>
            <Button variant="ghost" size="md" onClick={handleCancel}>
              <X size={15} />
              キャンセル
            </Button>
          </div>
        </FormPanel>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {inspectionItems.length} 件登録中
        </p>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditingId('new')
            setFormData({})
          }}
        >
          <Plus size={16} />
          新規追加
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-ink-700/50 border-b border-slate-200 dark:border-ink-700">
              <tr>
                <th className={thClass}>区分</th>
                <th className={thClass}>点検項目内容</th>
                <th className={thClass + ' text-right'}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-ink-700">
              {inspectionItems.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    登録されている対象区分がありません
                  </td>
                </tr>
              ) : (
                inspectionItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-ink-700/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <Badge tone="neutral">{item.category}</Badge>
                    </td>
                    <td className={tdClass}>{item.description}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionButtons
                        onEdit={() => handleEdit(item)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  const tabs = [
    { id: 'projects', label: '現場', Icon: Building2 },
    { id: 'staff', label: '社員', Icon: Users },
    { id: 'inspection-items', label: '対象区分', Icon: ListChecks },
  ]

  return (
    <div className="min-h-screen">
      {/* ページ上部余白：App.jsx のヘッダーボタンと重ならないよう確保 */}
      <div className="pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

        {/* ページ見出し */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <ListChecks size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              マスター管理
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              現場・スタッフ・対象区分の設定
            </p>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-1 bg-slate-100 dark:bg-ink-800 p-1 rounded-xl mb-6 border border-slate-200 dark:border-ink-700">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === id
                  ? 'bg-white dark:bg-ink-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden text-xs">{label}</span>
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-400 dark:text-slate-500">読み込み中...</p>
          </div>
        ) : (
          <>
            {activeTab === 'projects' && renderProjects()}
            {activeTab === 'staff' && renderStaff()}
            {activeTab === 'inspection-items' && renderInspectionItems()}
          </>
        )}
      </div>
    </div>
  )
}

export default MastersPage
