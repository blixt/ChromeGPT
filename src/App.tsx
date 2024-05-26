import { useCallback, useEffect, useState } from "react"
import "./App.css"

// General info about this file:
// - This is a TypeScript file for the popup of a Chrome Extension using Manifest v3
// - Its purpose is to represent an extension where the user can ask ChatGPT questions about the current tab they're looking at
// - We will do this by taking a screenshot of the active tab's area and send it to an active ChatGPT tab (or create a tab if one does not exist)

// What we need to do:
// - Check all ChatGPT tabs in parallel (promises) and execute a script in each one to find the ones that are in GPT-4 with vision mode
//   - Look at icon?
// - Also inject a message listener that can receive an image (data URL?) as well as text in order to ask ChatGPT questions
//   - It needs to be able to wait for the upload to complete, this can probably be done by looking at the Send button state
//   - Finally, it needs to simulate a click on the Send button
// - Probably the entire script that we execute in each ChatGPT tab should do all of the above setup, and early return `false` if the tab is not the appropriate GPT-4 with vision
//   - Return `true` if the message listener was set up in the tab
// - If in the end all come back `false` we should create a new tab with a new ChatGPT chat (with the correct mode)
// - If any tab changes we want to be aware of it and make sure we have an up-to-date state of addressable ChatGPT instances
// - In the final version of this UI we need to ask the user if they want to use any of their existing ChatGPT sessions, or create a new one

function useChatGPTTabs() {
    const [value, setValue] = useState<chrome.tabs.Tab[]>([])
    useEffect(() => {
        let active = true
        chrome.tabs.query({ url: "https://chat.openai.com/*" }).then(tabs => {
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

    const firstTabId = tabs[0]?.id
    const sendMessage = useCallback(async () => {
        if (!firstTabId || !imageURL) return
        await Promise.all([
            chrome.scripting.executeScript({
                target: { tabId: firstTabId },
                func: pasteImageInChatGPT,
                args: [imageURL, text || defaultText],
                world: "MAIN",
            }),
            chrome.tabs.update(firstTabId, { highlighted: true }),
        ])
        window.close()
    }, [firstTabId, imageURL, text])

    return (
        <div className="chat">
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
    const element: HTMLTextAreaElement | null = document.querySelector("textarea[placeholder='Send a message']")
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

    async function sleep(ms: number) {
        return new Promise<void>(resolve => {
            setTimeout(() => resolve(), ms)
        })
    }

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
