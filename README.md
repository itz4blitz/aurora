# Aurora AI Extension for VS Code

An attempt to create a VS Code extension that allows you to use OpenAI's GPT Pro model in a chat interface and apply it to your codebase like Cursor.

## Features

- 🤖 AI-powered code assistance and chat interface
- 💬 Context-aware conversations with code snippets
- 📝 Markdown rendering with syntax highlighting
- 💾 Local conversation history management
- 🔄 Import/Export conversation functionality

## Installation

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the TypeScript files
4. Press F5 in VS Code to launch the Extension Development Host

## Commands

- `Aurora: Open Chat` - Opens a new chat interface
- `Aurora: Show History` - Displays your conversation history
- `Aurora: Export Conversations` - Export your conversations to a file
- `Aurora: Import Conversations` - Import previously exported conversations
- `Aurora: Toggle Model` - Switch between available AI models

## Development

### Build Scripts

```json:package.json
startLine: 159
endLine: 173
```

### Project Structure

- `/src` - Main extension source code
- `/media` - Web assets (styles, scripts)
- `/resources` - Extension resources and icons
- `/dist` - Compiled output (generated)

### Configuration

The extension uses TypeScript path aliases for better code organization:
```json:tsconfig.json
startLine: 20
endLine: 34
```

## Requirements

- VS Code or Cursor 1.85.0 or higher
- Node.js 16.x or higher
- Google API key for Gemini Pro access
- Anthropic API key for Claude 3.5 Sonnet access
- GPT Pro Subscription for GPT Pro iframe access

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run format` to ensure code quality
5. Submit a pull request

## License

MIT

## Privacy

All conversations are stored locally on your machine. No data is sent to external servers except for the necessary API calls to Google's Gemini Pro service.