import { useEffect, useState } from "react"

export type TabWithId = chrome.tabs.Tab & { id: number }
export function tabHasId(tab: chrome.tabs.Tab): tab is TabWithId {
    return typeof tab.id === "number"
}

export function useChatGPTTabs() {
    const [value, setValue] = useState<TabWithId[]>([])
    useEffect(() => {
        let active = true
        chrome.tabs.query({ url: ["https://chatgpt.com/*", "https://chat.openai.com/*"] }).then(tabs => {
            if (!active) return
            setValue(tabs.filter(tabHasId))
        })
        return () => {
            active = false
        }
    }, [])
    return value
}
