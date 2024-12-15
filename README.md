# o1pro-extension
A demonstration VSCode extension that tries to embed a web-based "o1 pro" chat interface via a local proxy server.

## Instructions
1. Run `npm install`
2. Run `npm run compile`
3. Run `node server.js` to start the proxy server
4. Press F5 in VSCode to launch the Extension Host.
5. Run "o1pro: Open o1 pro Chat" command to open the webview panel.
6. Interact with the embedded page and observe the overlay UI injected by our script.

## Notes
- This approach relies on being able to load the target page through a local proxy.
- Without a real o1 pro URL and markup, we can only demonstrate the concept.