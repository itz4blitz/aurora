interface VSCodeAPI {
  postMessage<T extends WebviewMessage>(message: T): void;
  setState<T extends State>(state: T): void;
  getState<T extends State>(): T | undefined;
}

declare function acquireVsCodeApi(): VSCodeAPI;

interface State {
  messages: ChatMessage[];
}

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface WebviewMessage {
  command: 'sendMessage' | 'loadHistory';
  text?: string;
}

interface UpdateChatMessage {
  type: 'updateChat';
  messages: ChatMessage[];
}

(function initializeChat(): void {
  const vscode = acquireVsCodeApi();
  const messagesContainer = document.getElementById('messages') as HTMLDivElement;
  const userInput = document.getElementById('userInput') as HTMLTextAreaElement;
  const sendButton = document.getElementById('sendButton') as HTMLButtonElement;

  // Initialize
  vscode.postMessage<WebviewMessage>({ command: 'loadHistory' });

  // Handle sending messages
  sendButton.addEventListener('click', () => {
    const text = userInput.value.trim();
    if (text) {
      vscode.postMessage<WebviewMessage>({
        command: 'sendMessage',
        text: text,
      });
      userInput.value = '';
    }
  });

  // Handle keyboard shortcuts
  userInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });

  // Handle messages from extension
  window.addEventListener('message', (event: MessageEvent<UpdateChatMessage>) => {
    const message = event.data;
    switch (message.type) {
      case 'updateChat':
        updateChatView(message.messages);
        break;
    }
  });

  function updateChatView(messages: ChatMessage[]): void {
    messagesContainer.innerHTML = messages
      .map(
        (msg) => `
            <div class="message ${msg.type}">
                <div class="content">${escapeHtml(msg.content)}</div>
                <div class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
        `
      )
      .join('');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
