const vscode = require('vscode')
const path = require('path')
const jsyaml = require('js-yaml')

const EXT_NAME = "simple-text-refine"

const TEMPLATE = `
- label: 添削
  description: |
    作成中の技術文書を添削し修正案を返してください。
    文中で<<と>>で囲まれた部分はあなたへの指示であり、またXXXと書かれた部分はあなたに埋めて欲しい箇所です。
    メモ書きのようになっている箇所に対しては、自然な文章になるように補正してください。
    その際、箇条書きを地の文に変更したり、適当な見出しを追加するなどの形式変更もしてかまいません。
- label: メール
  description: |
    メールやチャットの投稿下書きを書いているユーザーから作成中の文章が与えられるので、添削し修正案を返してください。
    書き始めで文章が不足していたり不連続と思われる場合はそれを補完し、ほぼ完成している場合は文体の改善などをメインに修正してください。
`.trimStart()

async function exists(uri){
    return await vscode.workspace.fs.stat(uri).then(() => true, () => false)
}

// プロンプトを記載したファイルを探して返す。具体的にはworkspace直下の.vscode/simple-text-refine/.prompt,
async function getDefaultPromptPath() {
    const wf = vscode.workspace.workspaceFolders
    if(wf){
        const wfPromptPath = vscode.Uri.joinPath(wf[0].uri, '.vscode', EXT_NAME, '.prompt')
        if (await exists(wfPromptPath)) {
            return wfPromptPath
        } else {
            // promptファイルが無いことを通知しつつ、作成を促す
            const selection = await vscode.window.showErrorMessage('.prompt not found', 'Create')
            if (selection === 'Create') {
                await vscode.workspace.fs.writeFile(wfPromptPath, Buffer.from(TEMPLATE))
                await openFileAbove(wfPromptPath)
                // promptを開いたのでその後の処理は中止
                throw new Error('Canceled (no notification)')
            }
        }
    }

    throw new Error('Failed to open prompt file: workspace is not selected.')
}

// Display a UI to select the desired prompt from within the .prompt file for use with QuickPick
async function selectPrompt(promptPath) {
    const promptYaml = await vscode.workspace.openTextDocument(promptPath).then(doc => doc.getText())

    // Parse and check if it's array
    const prompts = jsyaml.load(promptYaml)
    if (!Array.isArray(prompts)) {
        throw new Error(`.prompt is not an YAML format array`)
    }

    // Display the choices at VSCode QuickPick
    const items = prompts.map(p => {
        // p is either a string or an object with {label, description}
        if (typeof p === 'string') {
            return {label: "", description: p}
        } else {
            // force convert string
            if (typeof p.label !== 'string') p.label = p.label?.toString() || ""
            if (typeof p.description !== 'string') p.description = p.description?.toString() || ""
            return p
        }
    })
    const result = await vscode.window.showQuickPick(items);
    if (result) {
        return result.description
    } else {
        throw new Error('Canceled');
    }
}

async function openFileAbove(file){
    // 既に開かれているか調べる → 開かれていればそのファイルにフォーカスを移動する
    const allEditors = vscode.window.visibleTextEditors
    const openedEditor = allEditors.find(editor => editor.document.uri.fsPath === file.fsPath)
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
        const doc = await vscode.workspace.openTextDocument(file)
        await vscode.window.showTextDocument(doc)
    }
}

// promptファイルをエディタ画面で開く
async function openPromptFile() {
    const promptFile = await getDefaultPromptPath()
    if (! promptFile) {
        vscode.window.showErrorMessage('.prompt not found')
        return
    }
    if (promptFile) {
        await openFileAbove(promptFile)
    }
}

module.exports = { openPromptFile, selectPrompt, getDefaultPromptPath }
