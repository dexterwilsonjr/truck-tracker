import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { installBrand } from "@/config/brand"
import App from "@/App"
import "@/index.css"

// Apply the brand palette + document title before first paint.
installBrand()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
