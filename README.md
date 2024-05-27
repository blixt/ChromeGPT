# ChromeGPT

## Installation

Sorry, there's no smooth installation for this right now. You'll need to follow
these steps:

1. In a terminal, clone the repo: `git clone https://github.com/blixt/ChromeGPT.git`
2. Enter the repo and run `yarn` ([more info here](https://yarnpkg.com/getting-started/install))
3. Now build the extension with `yarn build`
4. In Google Chrome:
   1. Go to **Manage Extensions**
   2. Enable **Developer Mode**
   3. Click **Load Unpacked Extension**
   4. Browse to the `dist` directory inside of `ChromeGPT`
5. The extension should now be available!

Note that installing an extension via Developer Mode bypasses review and
security measures. I vouch for the code in this repository not doing anything
malicious, but it's always a good idea to carefully review the code before
running it, since this extension is able to inject code into, and take
screenshots of, all of your browser tabs. That said, a surprising number of
extensions are able to do this, so always be careful!

## How it works

This Chrome extension will be able to take a screenshot of any of your tabs, and
then send the screenshot to ChatGPT, optionally with an associated message (if
you don't write anything, it defaults to "Describe this image").

To open it, you can press Alt+C / Option+C. This is what it looks like:

![Screenshot 2024-05-26 at 12 43 58](https://github.com/blixt/ChromeGPT/assets/158591/fc009de3-1f0c-4f2b-bd79-80d33bf30079)

To send the query to ChatGPT, hit Enter. If you already have a ChatGPT tab open, you can pick it in the dropdown.

![Screenshot 2024-05-26 at 12 45 12](https://github.com/blixt/ChromeGPT/assets/158591/fefd7ac0-b5c7-4d72-b28c-c268acdae18a)

### For developers

More concretely, this extension injects a bit of JavaScript that finds the
`<textarea>` with a specific placeholder ("Message ChatGPT"), sends it a fake
`paste` event containing the image as a `File` and then a fake `input` event
with the text. Then it waits for up to one minute to see if the button with
`data-testid="send-button"` becomes enabled, and proceeds to click it when it
does.
