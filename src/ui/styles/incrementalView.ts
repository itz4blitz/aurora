export const incrementalViewStyles = `
    .review-container {
        padding: 1rem;
        max-width: 100%;
        margin: 0 auto;
    }

    .action-bar {
        display: flex;
        justify-content: space-between;
        margin-top: 1rem;
        padding: 0.5rem;
        background: var(--vscode-editor-lineHighlightBackground);
        border-radius: 4px;
    }

    .action-button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s ease;
    }

    .action-button.accept {
        background: var(--vscode-testing-iconPassed);
        color: var(--vscode-button-foreground);
    }

    .action-button.modify {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }

    .action-button.reject {
        background: var(--vscode-testing-iconFailed);
        color: var(--vscode-button-foreground);
    }

    .action-button:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .action-button:active {
        transform: translateY(0);
    }

    .modify-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--vscode-editor-background);
        padding: 1rem;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
    }

    .modify-dialog.hidden {
        display: none;
    }

    .modify-dialog textarea {
        width: 100%;
        min-height: 200px;
        margin-bottom: 1rem;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        padding: 0.5rem;
        font-family: var(--vscode-editor-font-family);
    }

    .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }

    .dialog-actions button {
        padding: 6px 12px;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }

    .dialog-actions button:hover {
        background: var(--vscode-button-hoverBackground);
    }
`; 