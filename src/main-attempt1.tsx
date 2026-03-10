import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'

// ⚠️  Import order matters:
// 1. tailwindcss must be imported FIRST as a JS module (handled by @tailwindcss/vite plugin)
//    This bypasses Vite's CSS @import resolver which would crash on the "use strict" JS file
// 2. Then our own CSS (which must NOT contain @import "tailwindcss")
import 'tailwindcss/index.css'  // Virtual CSS injected by @tailwindcss/vite — no @import needed in .css files
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
