import { useEffect, useState } from "react"

export function useIsDarkMode() {
    const [query] = useState(() => window.matchMedia("(prefers-color-scheme: dark)"))
    const [isDark, setIsDark] = useState(query.matches)
    useEffect(() => {
        const listener = (e: MediaQueryListEvent) => {
            setIsDark(e.matches)
        }
        query.addEventListener("change", listener)
        return () => query.removeEventListener("change", listener)
    }, [query])
    return isDark
}
