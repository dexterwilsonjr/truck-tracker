import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { installBrand } from "@/config/brand"
import { installClientErrorReporting } from "@/lib/errors"
import App from "@/App"
import "@/index.css"

// Apply the brand palette + document title before first paint.
installBrand()

// Only when there is a real API to report to. On the sales demo the fetch would
// 404 and the report would be discarded anyway.
if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
  installClientErrorReporting(() => window.location.pathname)
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && import.meta.env.VITE_API_URL && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js").catch(() => { /* Offline support is optional. */ })
}
