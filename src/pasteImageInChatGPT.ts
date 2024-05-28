type FakeFileList = File[] & { item(index: number): File | null }

// Code that will run inside of the ChatGPT tab. For this reason, this function
// must not reference any outside code.
export async function pasteImageInChatGPT(dataURI: string, text: string) {
    async function sleep(ms: number) {
        return new Promise<void>(resolve => {
            setTimeout(() => resolve(), ms)
        })
    }

    async function sleepUntil(condition: () => boolean, timeout = 10_000) {
        const start = performance.now()
        while (!condition()) {
            await sleep(50)
            if (performance.now() - start > timeout) {
                throw Error(`Timed out waiting for condition ${condition.toString().replace(/^\(\) => /, "")}`)
            }
        }
    }

    // The file upload capability must exist.
    await sleepUntil(() => document.querySelector("input[type=file]") !== null)

    // Find the text input.
    const element: HTMLTextAreaElement | null = document.querySelector("textarea")
    if (!element) {
        throw Error("Could not find text input")
    }

    // Turn the data URI into a File object.
    const parts = dataURI.split(";base64,")
    const imageType = parts[0].split(":")[1]
    const decodedData = window.atob(parts[1])
    const uInt8Array = new Uint8Array(decodedData.length)
    for (let i = 0; i < decodedData.length; ++i) {
        uInt8Array[i] = decodedData.charCodeAt(i)
    }
    const file = new File([uInt8Array], "image", { type: imageType })

    // Create a fake "paste" event containing the image.
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

    // Fake that we typed the text into the text input.
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
    const sendButton = document.querySelector("[data-testid*='send-button']") as HTMLButtonElement | null
    if (!sendButton) {
        throw Error("Could not find send button")
    }

    // Wait ~1 minute to upload image before we give up.
    await sleepUntil(() => !sendButton.disabled, 60_000)
    // Send the message by simulating a click on the Send button.
    sendButton.click()
}
