export const codeBlockStyles = `
    .code-block {
        margin: 1.5rem 0;
        background: var(--vscode-editor-background);
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 1rem;
        background: var(--vscode-editor-lineHighlightBackground);
        border-bottom: 1px solid var(--vscode-editor-lineHighlightBorder);
    }

    .language-label {
        font-size: 0.85rem;
        color: var(--vscode-editor-foreground);
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .copy-button {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 3px;
        padding: 4px 8px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .copy-button:hover {
        background: var(--vscode-button-hoverBackground);
    }

    .copy-button:active {
        transform: translateY(1px);
    }

    .code-block pre {
        margin: 0;
        padding: 1rem;
        overflow-x: auto;
    }

    .code-block code {
        font-family: var(--vscode-editor-font-family, 'Consolas, Monaco, monospace');
        font-size: var(--vscode-editor-font-size, 14px);
        line-height: 1.5;
        tab-size: 4;
    }

    /* Syntax Highlighting Tokens */
    .token-type { color: var(--vscode-symbolIcon-typeParameter-foreground); }
    .token-string { color: var(--vscode-symbolIcon-string-foreground); }
    .token-keyword { color: var(--vscode-symbolIcon-keyword-foreground); }
    .token-number { color: var(--vscode-symbolIcon-number-foreground); }
    .token-comment { color: var(--vscode-symbolIcon-comment-foreground); }
    .token-function { color: var(--vscode-symbolIcon-function-foreground); }
    .token-class { color: var(--vscode-symbolIcon-class-foreground); }
    .token-variable { color: var(--vscode-symbolIcon-variable-foreground); }
    .token-property { color: var(--vscode-symbolIcon-property-foreground); }
    .token-operator { color: var(--vscode-symbolIcon-operator-foreground); }

    /* Animation for copy feedback */
    @keyframes copyFeedback {
        0% { transform: scale(1); }
        50% { transform: scale(0.95); }
        100% { transform: scale(1); }
    }

    .copy-success {
        animation: copyFeedback 0.2s ease;
        background: var(--vscode-testing-iconPassed) !important;
    }

    /* Dark theme adjustments */
    .vscode-dark .code-block {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    /* High Contrast theme adjustments */
    .vscode-high-contrast .code-block {
        border: 1px solid var(--vscode-contrastBorder);
        box-shadow: none;
    }
`;

// Copy functionality script
export const copyScript = `
    function copyCode(button) {
        const codeBlock = button.closest('.code-block');
        const code = codeBlock.querySelector('code').textContent;
        
        navigator.clipboard.writeText(code).then(() => {
            button.textContent = 'Copied!';
            button.classList.add('copy-success');
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copy-success');
            }, 2000);
        }).catch(err => {
            button.textContent = 'Failed';
            console.error('Failed to copy:', err);
            
            setTimeout(() => {
                button.textContent = 'Copy';
            }, 2000);
        });
    }
`;
