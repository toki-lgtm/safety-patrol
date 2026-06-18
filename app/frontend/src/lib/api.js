// 共通 API ユーティリティ
// getApiUrl / API_URL / authHeaders の重複定義を集約する。
// main.jsx の axios interceptor が既に Authorization を付与しているが、
// 各コンポーネントの手動 headers 渡しは挙動維持のためそのまま使用する。

export const API_URL = process.env.NODE_ENV !== 'production'
  ? 'http://localhost:3000'
  : 'https://portal-api-hhlx.onrender.com'

export const getApiUrl = () => API_URL

export const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('authToken')}`
})
