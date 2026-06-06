import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('main.jsx loaded')

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
