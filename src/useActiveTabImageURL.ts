import { useEffect, useState } from "react"

export function useActiveTabImageURL() {
    const [url, setURL] = useState<string | Error | null>(null)
    useEffect(() => {
        let active = true
        chrome.tabs
            .captureVisibleTab()
            .then(imageURL => {
                if (!active) return
                setURL(imageURL)
            })
            .catch(setURL)
        return () => {
            active = false
        }
    }, [])
    return url
}
