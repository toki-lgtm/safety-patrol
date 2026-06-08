import { useState, useEffect } from 'react'
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react'
import DashboardPage from './pages/DashboardPage'
import MastersPage from './pages/MastersPage'
import Button from './components/ui/Button'
import ThemeToggle from './components/ui/ThemeToggle'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    // URL パラメータからユーザー情報とトークンを取得
    const params = new URLSearchParams(window.location.search)
    const userParam = params.get('user')
    const tokenParam = params.get('token')

    // ✅ ポータル発行のJWTを保存（API認可に使用）
    if (tokenParam) {
      localStorage.setItem('authToken', tokenParam)
    }

    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam))
        setUser(userData)
        localStorage.setItem('user', JSON.stringify(userData))
      } catch (e) {
        console.error('Failed to parse user from URL:', e)
      }
    } else {
      // localStorage からも取得を試みる
      const stored = localStorage.getItem('user')
      if (stored) {
        try {
          setUser(JSON.parse(stored))
        } catch (e) {
          console.error('Failed to parse user from localStorage:', e)
        }
      }
    }

    // ✅ URLからtoken/userを除去（履歴・Referer経由の漏洩を防ぐ）
    if (tokenParam || userParam) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    setIsLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('authToken')
    // ポータルに戻る
    const portalUrl = import.meta.env.VITE_PORTAL_URL || 'https://portal-app-beryl.vercel.app'
    window.location.href = portalUrl
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-ink-950 flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-ink-950 flex items-center justify-center px-4 transition-colors">
        <div className="fixed top-5 right-5">
          <ThemeToggle />
        </div>
        <div className="max-w-md w-full bg-white dark:bg-ink-800 rounded-2xl shadow-xl border border-slate-200 dark:border-ink-700 p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand-600 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">安全パトロール</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">月次点検アプリ ・ 中原建設</p>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            社内ポータルでログインしてください
          </p>
          <a
            href="https://portal-app-beryl.vercel.app"
            className="inline-flex w-full items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 px-4 rounded-xl transition"
          >
            ポータルに戻る
          </a>
        </div>
      </div>
    )
  }

  if (currentPage === 'masters') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-ink-950 transition-colors">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCurrentPage('dashboard')}>
            <ArrowLeft className="w-4 h-4" /> 戻る
          </Button>
          <ThemeToggle />
          <Button variant="danger" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4" /> ログアウト
          </Button>
        </div>
        <MastersPage />
      </div>
    )
  }

  return (
    <DashboardPage
      user={user}
      onLogout={handleLogout}
      onOpenMasters={() => setCurrentPage('masters')}
    />
  )
}

export default App
