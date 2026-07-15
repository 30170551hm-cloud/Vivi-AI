import '@/lib/requestInterceptor'; // DEBE ser el primer import — instala el interceptor antes de todo lo demás
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
