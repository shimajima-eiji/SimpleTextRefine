const vscode = require('vscode')
const path = require('path')

// プロンプトを記載したファイルを探して返す。優先順位は以下の通り
// 1. {ファイル名}.prompt,
// 2. (同じディレクトリの).prompt,
// 3. (親フォルダを再帰的に探索).prompt (workspace直下まで)
async function findPrompt(filePath) {
    // 1の条件
    const promptFile = vscode.Uri.file(`${filePath}.prompt`)
    if (await vscode.workspace.fs.stat(promptFile).then(() => true, () => false)) {
        return promptFile
    }

    // 2, 3の条件
    async function recursion(dir){
        const promptFile = vscode.Uri.file(path.join(dir, '.prompt'))
        const promptFileExists = await vscode.workspace.fs.stat(promptFile).then(() => true, () => false)
        if (promptFileExists) {
            return promptFile
        } else {
            const parentDir = path.dirname(dir)
            return dir === parentDir ? null : recursion(parentDir)
        }
    }

    return recursion(path.dirname(filePath))
}

async function openPrompt(textEditor, textEditorEdit) {
    console.log({textEditor, textEditorEdit})
    const promptFile = await findPrompt(textEditor.document.uri.fsPath)
    if (! promptFile) {
        vscode.window.showErrorMessage('.prompt not found')
        return
    }
    if (promptFile) {
        // 既に開かれているか調べる → 開かれていればそのファイルにフォーカスを移動する
        const allEditors = vscode.window.visibleTextEditors
        const openedEditor = allEditors.find(editor => editor.document.uri.fsPath === promptFile.fsPath)
        if (openedEditor) {
            console.log({openedEditor})
            await vscode.window.showTextDocument(openedEditor.document, {viewColumn: openedEditor.viewColumn})

        } else {
            // New Editor Group Above
            await vscode.commands.executeCommand('workbench.action.newGroupAbove', {ratio: 0.2})
            // Decrease Editor Height
            await vscode.commands.executeCommand('workbench.action.decreaseViewHeight')
            await vscode.commands.executeCommand('workbench.action.decreaseViewHeight')

            // 上部に作ったグループにdocを表示する (フォーカスも移動)
            const doc = await vscode.workspace.openTextDocument(promptFile)
            await vscode.window.showTextDocument(doc)
        }
    }

}

module.exports = { openPrompt, findPrompt }