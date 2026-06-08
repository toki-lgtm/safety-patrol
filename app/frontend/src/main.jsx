import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

console.log('main.jsx loaded')

// ✅ 全API呼び出しにポータル発行のJWTをBearerで付与
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ✅ トークン切れ・無効ならポータルへ戻して再ログイン
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    if (status === 401 || status === 403) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      const portalUrl = import.meta.env.VITE_PORTAL_URL || 'https://portal-app-beryl.vercel.app'
      window.location.href = portalUrl
    }
    return Promise.reject(error)
  }
)

// グローバルエラーハンドラを追加
window.addEventListener('error', (e) => {
  console.error('Global error caught:', e.message, e.error)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason)
})

try {
  const root = document.getElementById('root')
  if (root) {
    ReactDOM.createRoot(root).render(<App />)
    console.log('✅ App rendered successfully')
  } else {
    console.error('Root element not found!')
  }
} catch (err) {
  console.error('Fatal error during render:', err)
}
