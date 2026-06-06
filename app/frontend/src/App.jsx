import { useState, useEffect } from 'react'
import axios from 'axios'
import DashboardPage from './pages/DashboardPage'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // URL パラメータからユーザー情報を取得
    const params = new URLSearchParams(window.location.search)
    const userParam = params.get('user')

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
    setIsLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('authToken')
    // ポータルに戻る
    window.location.href = import.meta.env.VITE_PORTAL_URL || 'https://portal-app-beryl.vercel.app'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🛡️</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">安全パトロール</h1>
            <p className="text-slate-500">月次点検アプリ</p>
          </div>
          <p className="text-slate-600 mb-6">
            社内ポータルでログインしてください
          </p>
          <a
            href={import.meta.env.VITE_PORTAL_URL || 'https://portal-app-beryl.vercel.app'}
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
          >
            ポータルに戻る
          </a>
        </div>
      </div>
    )
  }

  return <DashboardPage user={user} onLogout={handleLogout} />
}

export default App
