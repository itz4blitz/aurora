import * as http from 'http';
import * as https from 'https';
import { EventEmitter } from 'events';

export interface ChatMessage {
  id: string;
  author: {
    role: 'user' | 'assistant';
  };
  content: {
    content_type: string;
    parts: string[];
  };
  metadata: {
    serialization_metadata: {
      custom_symbol_offsets: Record<string, unknown>[];
    };
  };
  create_time: number;
}

export interface ChatResponse {
  messages: ChatMessage[];
  conversation_id?: string;
  error?: string;
}

export class ChatServer extends EventEmitter {
  private server: http.Server;
  private readonly TARGET_HOST = 'chatgpt.com';
  private readonly TARGET_PATH = '/backend-alt/conversation';
  private authToken?: string;

  constructor() {
    super();
    this.server = this.createServer();
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private createServer(): http.Server {
    return http.createServer((req, res) => {
      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/chat' && req.method === 'POST') {
        void this.handleChatRequest(req, res);
      } else {
        this.serveClientInterface(res);
      }
    });
  }

  private handleChatRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const options = {
        hostname: this.TARGET_HOST,
        path: this.TARGET_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.authToken,
          Cookie: req.headers.cookie,
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
        this.emit('error', error);
      });

      proxyReq.write(body);
      proxyReq.end();
    });
  }

  private serveClientInterface(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(this.getClientHTML());
  }

  private getClientHTML(): string {
    return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>o1 pro Chat</title>
                <style>
                    ${this.getStyles()}
                </style>
            </head>
            <body>
                <div id="chat-container">
                    <div id="messages"></div>
                    <div id="input-container">
                        <textarea id="user-input"></textarea>
                        <button id="send-button">Send</button>
                    </div>
                </div>
                <script>
                    ${this.getClientScript()}
                </script>
            </body>
            </html>
        `;
  }

  private getStyles(): string {
    return `
            #chat-container { 
                height: 100vh; 
                display: flex; 
                flex-direction: column;
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            #messages { 
                flex: 1; 
                overflow-y: auto; 
                padding: 20px; 
            }
            #input-container { 
                padding: 20px; 
                display: flex;
                background: var(--vscode-editor-background);
            }
            #user-input { 
                flex: 1; 
                margin-right: 10px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 8px;
            }
            #send-button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                cursor: pointer;
            }
            .user-message, .assistant-message { 
                margin: 10px 0; 
                padding: 10px; 
                border-radius: 5px; 
            }
            .user-message { 
                background: var(--vscode-textBlockQuote-background);
            }
            .assistant-message { 
                background: var(--vscode-editor-inactiveSelectionBackground);
            }
            #conversation-search {
                width: 100%;
                padding: 8px;
                margin-bottom: 10px;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
            }
            .conversation-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .conversation-actions {
                display: flex;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .conversation-item:hover .conversation-actions {
                opacity: 1;
            }
            .model-badge {
                font-size: 0.8em;
                padding: 2px 6px;
                border-radius: 4px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
            }
            #model-switch {
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
            }
            .model-btn {
                padding: 4px 8px;
                border-radius: 4px;
                border: 1px solid var(--vscode-button-border);
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                cursor: pointer;
            }
            .model-btn.active {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
        `;
  }

  private getClientScript(): string {
    return `
            (function() {
                const vscode = acquireVsCodeApi();
                const messagesContainer = document.getElementById('messages');
                const userInput = document.getElementById('user-input');
                const sendButton = document.getElementById('send-button');

                // Add search functionality
                const searchInput = document.createElement('input');
                searchInput.id = 'conversation-search';
                searchInput.placeholder = 'Search conversations...';
                document.getElementById('conversation-list').prepend(searchInput);

                interface Conversation {
                    id: string;
                    title: string;
                    model?: 'chatgpt' | 'gemini';
                }

                let currentConversations: Conversation[] = [];

                function updateConversationList(conversations: Conversation[]) {
                    currentConversations = conversations;
                    const conversationList = document.getElementById('conversation-list');
                    const searchTerm = (document.getElementById('conversation-search') as HTMLInputElement).value.toLowerCase();
                    
                    const filtered = conversations.filter(conv => 
                        conv.title.toLowerCase().includes(searchTerm)
                    );

                    conversationList.innerHTML = filtered.map(conv => \`
                        <div class="conversation-item" data-id="\${conv.id}">
                            <span class="conversation-title">\${conv.title}</span>
                            <div class="conversation-actions">
                                <button class="model-badge \${conv.model || 'chatgpt'}">\${conv.model || 'chatgpt'}</button>
                                <button class="rename-btn" data-id="\${conv.id}">✏️</button>
                                <button class="delete-btn" data-id="\${conv.id}">🗑️</button>
                            </div>
                        </div>
                    \`).join('');

                    // Add event listeners
                    document.querySelectorAll('.conversation-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            const target = e.target as HTMLElement;
                            const convId = item.getAttribute('data-id');
                            
                            if (target.classList.contains('rename-btn')) {
                                const newTitle = prompt('Enter new title:');
                                if (newTitle) {
                                    vscode.postMessage({
                                        command: 'renameConversation',
                                        conversationId: convId,
                                        title: newTitle
                                    });
                                }
                            } else if (target.classList.contains('delete-btn')) {
                                if (confirm('Delete this conversation?')) {
                                    vscode.postMessage({
                                        command: 'deleteConversation',
                                        conversationId: convId
                                    });
                                }
                            } else {
                                vscode.postMessage({
                                    command: 'selectConversation',
                                    conversationId: convId
                                });
                            }
                        });
                    });
                }

                // Add model switcher
                const modelSwitch = document.createElement('div');
                modelSwitch.id = 'model-switch';
                modelSwitch.innerHTML = \`
                    <button class="model-btn active" data-model="chatgpt">ChatGPT</button>
                    <button class="model-btn" data-model="gemini">Gemini</button>
                \`;
                document.getElementById('input-container').prepend(modelSwitch);

                let currentModel = 'chatgpt';

                document.querySelectorAll('.model-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const target = e.target as HTMLElement;
                        currentModel = target.dataset.model || 'chatgpt';
                        document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
                        target.classList.add('active');
                    });
                });

                // Add real-time search
                searchInput.addEventListener('input', () => {
                    updateConversationList(currentConversations);
                });

                async function sendMessage(content) {
                    const requestBody = {
                        action: "next",
                        messages: [{
                            id: generateUUID(),
                            author: { role: "user" },
                            content: {
                                content_type: "text",
                                parts: [content]
                            },
                            metadata: {
                                serialization_metadata: { custom_symbol_offsets: [] }
                            },
                            create_time: Date.now() / 1000
                        }],
                        model: "o1-pro",
                        timezone_offset_min: new Date().getTimezoneOffset(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        suggestions: [],
                        conversation_mode: { kind: "primary_assistant" },
                        supports_buffering: true
                    };

                    try {
                        const response = await fetch('/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestBody)
                        });

                        if (!response.ok) {
                            throw new Error(\`HTTP error! status: \${response.status}\`);
                        }

                        const data = await response.json();
                        return data;
                    } catch (error) {
                        vscode.postMessage({
                            command: 'error',
                            text: error.message
                        });
                        return null;
                    }
                }

                function generateUUID() {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                }

                function addMessage(content, isUser) {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = isUser ? 'user-message' : 'assistant-message';
                    messageDiv.textContent = content;
                    messagesContainer.appendChild(messageDiv);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }

                sendButton.addEventListener('click', async () => {
                    const content = userInput.value.trim();
                    if (!content) return;

                    sendButton.disabled = true;
                    addMessage(content, true);
                    userInput.value = '';

                    try {
                        const response = await sendMessage(content);
                        if (response && response.messages) {
                            const assistantMessage = response.messages.find(m => m.author.role === 'assistant');
                            if (assistantMessage) {
                                addMessage(assistantMessage.content.parts[0], false);
                            }
                        }
                    } finally {
                        sendButton.disabled = false;
                    }
                });

                userInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendButton.click();
                    }
                });

                const conversationListStyles = \`
                    #conversation-list {
                        width: 250px;
                        border-right: 1px solid var(--vscode-widget-border);
                        overflow-y: auto;
                        padding: 10px;
                    }
                    .main-container {
                        display: flex;
                        height: 100vh;
                    }
                    .conversation-item {
                        padding: 8px;
                        margin: 4px 0;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .conversation-item:hover {
                        background: var(--vscode-list-hoverBackground);
                    }
                    .conversation-item.active {
                        background: var(--vscode-list-activeSelectionBackground);
                        color: var(--vscode-list-activeSelectionForeground);
                    }
                \`;

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateConversations':
                            updateConversationList(message.conversations);
                            break;
                    }
                });
            })();
        `;
  }

  start(port = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`Chat server running at http://localhost:${port}/`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
