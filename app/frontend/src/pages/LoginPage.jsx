import { useState } from 'react'
import axios from 'axios'
import { useGoogleLogin } from '@react-oauth/google'

function LoginPage({ onLoginSuccess }) {
  const [isLoading, setIsLoading] = useState(false)

  const login = useGoogleLogin({
    onSuccess: async (credentialResponse) => {
      setIsLoading(true)
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/auth/google`,
          { token: credentialResponse.access_token }
        )
        localStorage.setItem('authToken', credentialResponse.access_token)
        localStorage.setItem('user', JSON.stringify(response.data))
        onLoginSuccess(response.data)
      } catch (error) {
        console.error('Login failed:', error)
        alert('ログインに失敗しました')
      } finally {
        setIsLoading(false)
      }
    },
    onError: () => {
      alert('ログインに失敗しました')
    },
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">🛡️</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">安全パトロール</h1>
            <p className="text-slate-500">月次点検アプリ</p>
          </div>

          <p className="text-slate-600 mb-8">
            Google アカウントでログインしてください
          </p>

          <button
            onClick={() => login()}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
          >
            {isLoading ? 'ログイン中...' : 'Google でログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
