import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { AspectRatio, Button, Callout, Flex, Select, Skeleton, Text, TextField } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { pasteImageInChatGPT } from "./pasteImageInChatGPT"
import { useChatGPTTabs } from "./tabs"
import { useActiveTabImageURL } from "./useActiveTabImageURL"
import { useLocalStorage } from "./useLocalStorage"

const defaultText = "Describe this image."

export default function MainScreen() {
    const tabs = useChatGPTTabs()
    const imageURL = useActiveTabImageURL()
    // Persist the text value so that accidentally closing the extension doesn't
    // lose whatever was written.
    const [text, setText] = useLocalStorage("text", "")
    const [selectedTabId, setSelectedTabId] = useState(tabs[0]?.id ?? -1)
    const [isSending, setIsSending] = useState(false)

    const sendMessage = useCallback(async () => {
        if (typeof imageURL !== "string") return
        setIsSending(true)
        let tabId = selectedTabId
        if (tabId === -1) {
            // Remember to update model here as the ChatGPT UI evolves.
            const tab = await chrome.tabs.create({ url: "https://chatgpt.com/?model=gpt-4o", active: false })
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
        await Promise.all([
            chrome.scripting.executeScript({
                target: { tabId },
                func: pasteImageInChatGPT,
                args: [imageURL, text || defaultText],
                world: "MAIN",
            }),
            chrome.tabs.update(tabId, { active: true }),
        ])
        // Resets the persisted value.
        setText("")
        window.close()
    }, [selectedTabId, imageURL, text, setText])

    return (
        <Flex direction="column" gap="2">
            <Select.Root value={String(selectedTabId)} onValueChange={id => setSelectedTabId(Number(id))}>
                <Select.Trigger variant="soft" />
                <Select.Content position="popper">
                    <Select.Item value="-1">Send to new ChatGPT session</Select.Item>
                    {tabs.map(tab => (
                        <Select.Item key={tab.id} value={String(tab.id)}>
                            Send to: {tab.title}
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>
            <Text size="2">This is what ChatGPT will see when you ask your question:</Text>
            <AspectRatio ratio={16 / 9}>
                {typeof imageURL === "string" ? (
                    <img
                        src={imageURL}
                        alt="Screenshot of your screen"
                        style={{
                            objectFit: "cover",
                            width: "100%",
                            height: "100%",
                            borderRadius: "var(--radius-2)",
                        }}
                    />
                ) : imageURL instanceof Error ? (
                    <Callout.Root color="red" role="alert">
                        <Callout.Icon>
                            <ExclamationTriangleIcon />
                        </Callout.Icon>
                        <Callout.Text>{imageURL.message}</Callout.Text>
                    </Callout.Root>
                ) : (
                    <Skeleton width="100%" height="100%" loading />
                )}
            </AspectRatio>
            <Flex direction="row" gap="2">
                <TextField.Root
                    autoFocus
                    disabled={isSending}
                    onChange={e => setText(e.currentTarget.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    value={text}
                    type="text"
                    placeholder="Question about screenshot"
                    variant="soft"
                    style={{ flex: 1 }}
                />
                <Button loading={isSending} onClick={sendMessage} type="button">
                    Send
                </Button>
            </Flex>
        </Flex>
    )
}
