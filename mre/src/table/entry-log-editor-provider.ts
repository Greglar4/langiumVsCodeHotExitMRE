import * as vscode from 'vscode'
import {
	CodeActionTriggerKind,
	LanguageClient,
	TextDocumentIdentifier,
	Range,
	CodeActionContext,
	CodeAction,
	TextDocumentEdit
} from 'vscode-languageclient/node.js'
import { TableChange } from '../language/main'

export class EntryLogEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext, client: LanguageClient): vscode.Disposable {
		const provider = new EntryLogEditorProvider(context, client)
		return vscode.window.registerCustomEditorProvider(EntryLogEditorProvider.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		})
	}

	private static readonly EDIT_COMMANDS = ['editId', 'editDescription', 'createEntry']

	private static readonly viewType = 'mre.entryLog'

	private webviewPanels: { webviewPanel: vscode.WebviewPanel; uri: string }[] = []
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly client: LanguageClient,
	) {
		context.subscriptions.push(this.documentChangeListener)
	}
    
    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): Thenable<void> | void {
		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		}

		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview)

		this.webviewPanels.push({ webviewPanel: webviewPanel, uri: document.uri.toString(true) })

		webviewPanel.onDidDispose(() => {
			this.webviewPanels = this.webviewPanels.filter((panel) => panel.webviewPanel !== webviewPanel)
		})

        webviewPanel.webview.onDidReceiveMessage((message) => {
			if (message.command === 'modelRequest') {
				this.updateWebview(document.uri.toString(true))
			} else if (EntryLogEditorProvider.EDIT_COMMANDS.includes(message.command)) {
				const codeActionParams: { textDocument: TextDocumentIdentifier; range?: Range; context: CodeActionContext } = {
					textDocument: TextDocumentIdentifier.create(document.uri.toString()),
					context: {
						triggerKind: CodeActionTriggerKind.Invoked,
						only: [message.editData.actionIdentifier],
						diagnostics: [
							{
								message: 'synthetic',
								range: Range.create(document.positionAt(0), document.positionAt(0)),
								data: message.editData,
							},
						],
					},
				}
				this.client.sendRequest('textDocument/codeAction', codeActionParams).then((res: CodeAction[] | unknown) => {
					if (res instanceof Array) {
						res.forEach((codeAction) => {
							if (!CodeAction.is(codeAction)) {
								return
							}
							if (codeAction.edit) {
								if (codeAction.edit.documentChanges) {
									codeAction.edit.documentChanges.forEach((change) => {
										if (TextDocumentEdit.is(change)) {
											const uri = vscode.Uri.parse(change.textDocument.uri)
											const edit = new vscode.WorkspaceEdit()
											change.edits.forEach((textDocumentEdit) => {
												const start = new vscode.Position(textDocumentEdit.range.start.line, textDocumentEdit.range.start.character)
												const end = new vscode.Position(textDocumentEdit.range.end.line, textDocumentEdit.range.end.character)
												const range = new vscode.Range(start, end)
												edit.replace(uri, range, textDocumentEdit.newText)
											})
											vscode.workspace.applyEdit(edit).then((value) => {
												if (value) {
													this.updateWebview(uri.toString(true))
												}
											})
										}
									})
								}
							}
						})
					}
				})
			}
        })
    }

    private updateWebview(uri: string): void {
		this.client.sendRequest('modelRequest', { uri: uri })
	}

    private documentChangeListener = this.client.onNotification('entryTableChange', (documentChange: TableChange) => {
		this.webviewPanels
			.filter((webviewPanel) => webviewPanel.uri === documentChange.uri)
			.forEach((panel) => {
				panel.webviewPanel.webview.postMessage(documentChange)
			})
	})

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'table', 'entry-log-app.mjs'),
		)

		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'out', 'table', 'entry-log-app.css'),
		)
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Panel Title Goes Here</title>
				<link rel="stylesheet" href="${styleUri}">
			</head>
			<body>
				<div id="root"></div>
				<script type="module" src="${scriptUri}"></script>
			</body>
			</html>`
	}
}