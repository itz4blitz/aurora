<div align="center">
  <img src="./media/aurora.jpg" alt="Aurora AI" width="400"/>
  <h1>Aurora AI Extension for VS Code</h1>
  <p>A powerful AI coding assistant that brings the northern lights to your development workflow</p>
</div>

## Overview

Aurora is a VS Code extension that seamlessly integrates multiple AI models (GPT Pro, Gemini Pro, Claude) into your development environment, providing intelligent code assistance, refactoring suggestions, and natural language interactions with your codebase.

## ✨ Features

- 🤖 **Multi-Model AI Support**
  - OpenAI GPT Pro integration
  - Google Gemini Pro capabilities
  - Anthropic Claude 3.5 Sonnet support

- 💡 **Intelligent Code Assistance**
  - Context-aware code suggestions
  - Automated refactoring proposals
  - Bug detection and fixes
  - Code documentation generation

- 💬 **Advanced Chat Interface**
  - Markdown rendering with syntax highlighting
  - Code snippet integration
  - Multi-file context support
  - Conversation threading

- 🔄 **Project Management**
  - Local conversation history
  - Import/Export functionality
  - Session persistence
  - Custom prompt templates

## 🚀 Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/aurora.git
cd aurora
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run compile
npm run build
```

4. Launch in VS Code:
- Press F5 to start debugging
- Or install the VSIX package directly

## 🎯 Commands

| Command | Description |
|---------|-------------|
| `Aurora: Open Chat` | Launch the AI chat interface |
| `Aurora: Show History` | View conversation history |
| `Aurora: Export Conversations` | Save conversations to file |
| `Aurora: Import Conversations` | Load previous conversations |
| `Aurora: Toggle Model` | Switch between AI models |

## 🛠️ Development

### Project Structure
```
aurora/
├── src/                # Source code
│   ├── commands/      # VS Code commands
│   ├── services/      # AI service integrations
│   ├── ui/           # User interface components
│   └── utils/        # Helper utilities
├── media/            # Assets and resources
├── dist/            # Compiled output
└── tests/           # Test suites
```

### Build System
- TypeScript compilation
- Webpack bundling
- ESLint + Prettier formatting
- Husky pre-commit hooks

### Configuration
The project uses TypeScript path aliases for clean imports:
```json
{
  "@/*": ["*"],
  "@ui/*": ["ui/*"],
  "@services/*": ["services/*"]
  // ... more aliases
}
```

## 📋 Requirements

- VS Code 1.85.0+
- Node.js 16.x+
- API Access:
  - OpenAI API key for model access
  - GPT Pro subscription for iframe integration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and linting:
```bash
npm run test
npm run lint
npm run format
```
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Privacy & Security

- All conversations are stored locally
- No data collection or telemetry
- API calls are made directly to respective services
- Credentials are stored securely in VS Code's secret storage

## 🌟 Acknowledgments

- Inspired by the beauty of the Aurora Borealis
- Built with VS Code's extensibility framework
- Powered by cutting-edge AI models
