import { useState, useEffect } from 'react'

function App() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.log('App component mounted')
    // URL パラメータからユーザー情報を取得
    const params = new URLSearchParams(window.location.search)
    const userParam = params.get('user')

    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam))
        setUser(userData)
        localStorage.setItem('user', JSON.stringify(userData))
        console.log('User from URL:', userData)
      } catch (e) {
        console.error('Failed to parse user from URL:', e)
      }
    } else {
      // localStorage からも取得を試みる
      const stored = localStorage.getItem('user')
      if (stored) {
        try {
          setUser(JSON.parse(stored))
          console.log('User from localStorage:', JSON.parse(stored))
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
    window.location.href = 'http://localhost:5173'
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
            ユーザー情報が取得できませんでした
          </p>
          <a
            href="http://localhost:5173"
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
          >
            ポータルに戻る
          </a>
        </div>
      </div>
    )
  }

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
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">ダッシュボード</h2>
          <p className="text-gray-600">
            安全パトロール月次点検アプリへようこそ！
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              ✅ アプリが正常に読み込まれました
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
