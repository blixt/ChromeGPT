import "@radix-ui/themes/styles.css"
import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./index.css"

const rootEl = document.getElementById("root")
if (!rootEl) throw Error("missing #root")

const root = createRoot(rootEl)
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
