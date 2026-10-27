import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles/global.css'
import { App } from './App'

const root = createRoot(document.getElementById('root')!)

if (window.api) {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
} else {
  // Opened in a plain browser (e.g. the dev server URL): the secure desktop bridge only exists
  // inside the Electron window, so nothing here could load or save data.
  root.render(
    <div className="splash">
      <div style={{ maxWidth: 420, textAlign: 'center', display: 'grid', gap: 10 }}>
        <h2>E-Board</h2>
        <p>This page only runs inside the E-Board desktop window.</p>
        <p dir="rtl">هذه الصفحة تعمل فقط داخل نافذة تطبيق E-Board على سطح المكتب.</p>
      </div>
    </div>
  )
}
