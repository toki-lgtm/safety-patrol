import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('main.jsx loaded')
console.log('root element:', document.getElementById('root'))

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(<App />)
} else {
  console.error('Root element not found!')
}
