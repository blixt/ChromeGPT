import { useCallback, useEffect, useState } from "react"
import "./App.css"

function useChatGPTTabs() {
    const [value, setValue] = useState<chrome.tabs.Tab[]>([])
    useEffect(() => {
        let active = true
        chrome.tabs.query({ url: ["https://chatgpt.com/*", "https://chat.openai.com/*"] }).then(tabs => {
            if (!active) return
            setValue(tabs)
        })
        return () => {
            active = false
        }
    }, [])
    return value
}

function useActiveTabImageURL() {
    const [url, setURL] = useState<string | null>(null)
    useEffect(() => {
        let active = true
        chrome.tabs.captureVisibleTab().then(imageURL => {
            if (!active) return
            setURL(imageURL)
        })
        return () => {
            active = false
        }
    }, [])
    return url
}

const defaultText = "Describe this image."

function App() {
    // TODO: Figure out how to attach to a specific ChatGPT tab, but do allow sourcing images from many tabs.
    const tabs = useChatGPTTabs()
    // TODO: Start uploading this image immediately so that it will mostly be done by the time the user hits Enter.
    const imageURL = useActiveTabImageURL()

    const [text, setText] = useState("")

    const [selectedTabId, setSelectedTabId] = useState<number>(tabs[0]?.id ?? -1)

    const sendMessage = useCallback(async () => {
        let tabId = selectedTabId
        if (tabId === -1) {
            const tab = await chrome.tabs.create({ url: "https://chatgpt.com", active: false })
            // Wait for the tab to load.
            await new Promise<void>(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (info.status === "complete" && tabId === tab.id) {
                        chrome.tabs.onUpdated.removeListener(listener)
                        resolve()
                    }
                })
            })
            if (!tab.id) return
            tabId = tab.id
        }
        if (!imageURL) return
        await Promise.all([
            chrome.scripting.executeScript({
                target: { tabId },
                func: pasteImageInChatGPT,
                args: [imageURL, text || defaultText],
                world: "MAIN",
            }),
            chrome.tabs.update(tabId, { active: true }),
        ])
        window.close()
    }, [selectedTabId, imageURL, text])

    return (
        <div className="chat">
            <select
                className="chat-tab-selector"
                defaultValue={selectedTabId}
                onChange={e => setSelectedTabId(Number(e.currentTarget.value))}
            >
                <option value="-1">Send to new ChatGPT session</option>
                {tabs.map(tab => (
                    <option key={tab.id} value={tab.id}>
                        Send to: {tab.title}
                    </option>
                ))}
            </select>
            <p className="chat-message">This is what ChatGPT will see when you ask your question.</p>
            {imageURL && (
                <img
                    alt="Screenshot of your screen"
                    src={imageURL}
                    style={{ width: "100%", height: 200, objectFit: "cover" }}
                />
            )}
            <div className="chat-input">
                <input
                    // biome-ignore lint/a11y/noAutofocus: <explanation>
                    autoFocus
                    onChange={e => setText(e.currentTarget.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    value={text}
                    type="text"
                    placeholder={defaultText}
                />
                <button onClick={sendMessage} type="button">
                    Send
                </button>
            </div>
        </div>
    )
}

export default App

type FakeFileList = File[] & { item(index: number): File | null }

// Code that will run inside of the ChatGPT tab.
async function pasteImageInChatGPT(dataURI: string, text: string) {
    async function sleep(ms: number) {
        return new Promise<void>(resolve => {
            setTimeout(() => resolve(), ms)
        })
    }

    // Waiting a little bit can help with some edge cases.
    await sleep(200)

    // Find the text input.
    const placeholder = "Message ChatGPT"
    const element: HTMLTextAreaElement | null = document.querySelector(`textarea[placeholder='${placeholder}']`)
    if (!element) return

    // Turn the data URI into a File object.
    const parts = dataURI.split(";base64,")
    const imageType = parts[0].split(":")[1]
    const decodedData = window.atob(parts[1])
    const uInt8Array = new Uint8Array(decodedData.length)
    for (let i = 0; i < decodedData.length; ++i) {
        uInt8Array[i] = decodedData.charCodeAt(i)
    }
    const file = new File([uInt8Array], "image", { type: imageType })

    // Create a fake "paste" event.
    const files = [file] as FakeFileList
    files.item = (index: number) => files[index] ?? null

    class FakeDataTransfer extends DataTransfer {
        constructor() {
            super()
            this.dropEffect = "none"
            this.effectAllowed = "all"
        }

        get files() {
            return files
        }

        get types() {
            return ["Files"]
        }
    }

    const clipboardData = new FakeDataTransfer()

    const event = new (class extends ClipboardEvent {
        constructor() {
            super("paste", { bubbles: true, cancelable: true })
        }

        get clipboardData() {
            return clipboardData
        }

        get isTrusted() {
            return true
        }
    })()

    // Send the event to the ChatGPT text input.
    element.focus()
    element.dispatchEvent(event)

    await sleep(10)

    element.value = text
    element.dispatchEvent(
        new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            composed: true,
            data: text,
            dataTransfer: null,
            inputType: "insertText",
            isComposing: false,
        }),
    )

    // Wait for the upload to complete...
    const sendButton = document.querySelector("[data-testid='send-button']") as HTMLButtonElement | null
    if (!sendButton) return

    // Try 600 times = ~1 minute to upload image before we give up.
    for (let i = 0; i < 600; i++) {
        if (!sendButton.disabled) {
            // Send the message by simulating a click on the Send button.
            sendButton.click()
            break
        }
        await sleep(100)
    }
}
