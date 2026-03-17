import * as vscode from 'vscode';
import { LocalizationProvider } from './localizationProvider';
import { LocalizationEntry } from './localizationEntry';
import { ConfigProvider, ConfigItem } from './configProvider';

export function activate(context: vscode.ExtensionContext) {
    const localizationProvider = new LocalizationProvider();
    const configProvider = new ConfigProvider();

    // 注册树形视图
    vscode.window.registerTreeDataProvider('localizationEntries', localizationProvider);
    vscode.window.registerTreeDataProvider('localizationConfig', configProvider);

    // 转换为本地化代码命令
    let convertDisposable = vscode.commands.registerCommand('localizationTool.convertText', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            vscode.window.showErrorMessage('请先选中要转换的文本');
            return;
        }

        // 解析选中的文本
        const parseResult = parseSelectedText(selectedText);
        if (!parseResult) {
            vscode.window.showErrorMessage('无法解析选中的文本，请确保选中的是字符串');
            return;
        }

        // 获取配置
        const config = vscode.workspace.getConfiguration('localizationTool');
        const nextId = config.get<number>('nextId', 1001);
        const functionName = config.get<string>('functionName', 'Lang:GetLang');

        // 检查选中文本外部是否被引号包围，如果是则扩展选区（使选中xxx和选中"xxx"结果一致）
        let adjustedSelection = selection;
        const currentLineText = editor.document.lineAt(selection.start.line).text;
        const charBefore = selection.start.character > 0 ? currentLineText[selection.start.character - 1] : '';
        const charAfter = selection.end.character < currentLineText.length ? currentLineText[selection.end.character] : '';

        if ((charBefore === '"' && charAfter === '"') || (charBefore === "'" && charAfter === "'")) {
            adjustedSelection = new vscode.Selection(
                new vscode.Position(selection.start.line, selection.start.character - 1),
                new vscode.Position(selection.end.line, selection.end.character + 1)
            );
        }

        // 获取选中区域后面的内容（同一行）
        const line = editor.document.lineAt(adjustedSelection.end.line);
        const afterSelection = line.text.substring(adjustedSelection.end.character);

        // 查找是否已有相同文本的条目，复用旧 ID
        const entries = config.get<LocalizationEntry[]>('entries', []);
        const existingId = findExistingEntryId(entries, parseResult.text);
        const usedId = existingId !== undefined ? existingId : nextId;
        const isReused = existingId !== undefined;

        // 生成代码
        const generatedCode = generateLocalizationCode(functionName, usedId, parseResult.formatArgs, parseResult.text, afterSelection, parseResult.formatArgsStr);

        // 显示确认弹窗
        const result = await showConfirmationDialog(parseResult.text, usedId, generatedCode);

        if (result === 'confirm' || result === 'copy') {
            if (result === 'confirm') {
                // 替换选中的文本（扩展到行尾，避免注释影响后续代码）
                const rangeToReplace = new vscode.Range(adjustedSelection.start, line.range.end);
                await editor.edit(editBuilder => {
                    editBuilder.replace(rangeToReplace, generatedCode);
                });
            } else {
                // 仅复制生成的代码到剪贴板，不替换
                await vscode.env.clipboard.writeText(generatedCode);
                vscode.window.showInformationMessage(`已复制本地化代码到剪贴板，ID: ${usedId}`);
            }

            // 仅在不复用时添加新条目并递增 ID
            if (!isReused) {
                entries.push({
                    id: nextId,
                    text: replaceFormatPlaceholders(parseResult.text),
                    description: '',
                    filePath: editor.document.uri.fsPath,
                    line: adjustedSelection.start.line
                });
                await config.update('nextId', nextId + 1, true);
            }

            // 更新配置
            await config.update('entries', entries, true);

            // 刷新视图
            localizationProvider.refresh();
            configProvider.refresh();

            if (result === 'confirm') {
                vscode.window.showInformationMessage(`已生成本地化代码，ID: ${nextId}`);
            }
        }
    });

    // 添加条目命令
    let addEntryDisposable = vscode.commands.registerCommand('localizationTool.addEntry', async () => {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const nextId = config.get<number>('nextId', 1001);

        const text = await vscode.window.showInputBox({
            prompt: '请输入本地化文本',
            placeHolder: '例如: 测试文本'
        });

        if (text === undefined) return;

        const description = await vscode.window.showInputBox({
            prompt: '请输入描述（可选）',
            placeHolder: '例如: 登录按钮文本'
        });

        if (description === undefined) return;

        const entries = config.get<LocalizationEntry[]>('entries', []);
        entries.push({
            id: nextId,
            text: text,
            description: description
        });

        await config.update('entries', entries, true);
        await config.update('nextId', nextId + 1, true);

        localizationProvider.refresh();
        configProvider.refresh();
        vscode.window.showInformationMessage(`已添加本地化条目，ID: ${nextId}`);
    });

    // 编辑条目命令
    let editEntryDisposable = vscode.commands.registerCommand('localizationTool.editEntry', async (entry: LocalizationEntry) => {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const entries = config.get<LocalizationEntry[]>('entries', []);

        const newText = await vscode.window.showInputBox({
            prompt: '编辑本地化文本',
            value: entry.text
        });

        if (newText === undefined) return;

        const newDescription = await vscode.window.showInputBox({
            prompt: '编辑描述',
            value: entry.description
        });

        if (newDescription === undefined) return;

        const index = entries.findIndex(e => e.id === entry.id);
        if (index !== -1) {
            entries[index].text = newText;
            entries[index].description = newDescription;
            await config.update('entries', entries, true);
            localizationProvider.refresh();
            vscode.window.showInformationMessage(`已更新本地化条目 ${entry.id}`);
        }
    });

    // 刷新视图命令
    let refreshDisposable = vscode.commands.registerCommand('localizationTool.refreshView', () => {
        localizationProvider.refresh();
        configProvider.refresh();
    });

    // 清空所有条目命令
    let clearEntriesDisposable = vscode.commands.registerCommand('localizationTool.clearEntries', async () => {
        const result = await vscode.window.showWarningMessage(
            '确定要清空所有本地化条目吗？此操作不可恢复。',
            { modal: true },
            '确定',
            '取消'
        );

        if (result === '确定') {
            const config = vscode.workspace.getConfiguration('localizationTool');
            await config.update('entries', [], true);
            localizationProvider.refresh();
            configProvider.refresh();
            vscode.window.showInformationMessage('已清空所有本地化条目');
        }
    });

    // 设置当前ID命令
    let setNextIdDisposable = vscode.commands.registerCommand('localizationTool.setNextId', async () => {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const currentNextId = config.get<number>('nextId', 1001);

        const newIdStr = await vscode.window.showInputBox({
            prompt: '设置当前本地化ID',
            value: currentNextId.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1) {
                    return '请输入有效的正整数';
                }
                return null;
            }
        });

        if (newIdStr === undefined) return;

        const newId = parseInt(newIdStr);
        await config.update('nextId', newId, true);
        configProvider.refresh();
        vscode.window.showInformationMessage(`当前本地化ID已设置为: ${newId}`);
    });

    // 编辑配置项命令（点击配置项时触发）
    let editConfigDisposable = vscode.commands.registerCommand('localizationTool.editConfig', async (item: ConfigItem) => {
        const config = vscode.workspace.getConfiguration('localizationTool');

        if (item.key === 'nextId') {
            const newIdStr = await vscode.window.showInputBox({
                prompt: '设置当前本地化ID',
                value: item.value,
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1) {
                        return '请输入有效的正整数';
                    }
                    return null;
                }
            });

            if (newIdStr !== undefined) {
                const newId = parseInt(newIdStr);
                await config.update('nextId', newId, true);
                configProvider.refresh();
                vscode.window.showInformationMessage(`当前本地化ID已设置为: ${newId}`);
            }
        } else if (item.key === 'functionName') {
            const newFunctionName = await vscode.window.showInputBox({
                prompt: '设置本地化函数名称',
                value: item.value,
                placeHolder: '例如: Lang:GetLang'
            });

            if (newFunctionName !== undefined && newFunctionName.trim() !== '') {
                await config.update('functionName', newFunctionName.trim(), true);
                configProvider.refresh();
                vscode.window.showInformationMessage(`本地化函数名称已设置为: ${newFunctionName}`);
            }
        }
    });

    // 跳转到条目代码位置命令
    let gotoEntryLocationDisposable = vscode.commands.registerCommand('localizationTool.gotoEntryLocation', async (entry: LocalizationEntry) => {
        if (!entry.filePath || entry.line === undefined) {
            vscode.window.showWarningMessage('该条目没有关联的代码位置');
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(entry.filePath);
            const openedEditor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(entry.line, 0);
            openedEditor.selection = new vscode.Selection(position, position);
            openedEditor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        } catch {
            vscode.window.showErrorMessage(`无法打开文件: ${entry.filePath}`);
        }
    });

    // 删除单条条目命令
    let deleteEntryDisposable = vscode.commands.registerCommand('localizationTool.deleteEntry', async (entry: LocalizationEntry) => {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const entries = config.get<LocalizationEntry[]>('entries', []);
        const newEntries = entries.filter(e => e.id !== entry.id);

        await config.update('entries', newEntries, true);
        localizationProvider.refresh();
        vscode.window.showInformationMessage(`已删除本地化条目 ${entry.id}`);
    });

    // 复制所有条目命令
    let copyAllEntriesDisposable = vscode.commands.registerCommand('localizationTool.copyAllEntries', async () => {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const entries = config.get<LocalizationEntry[]>('entries', []);

        if (entries.length === 0) {
            vscode.window.showWarningMessage('没有本地化条目可复制');
            return;
        }

        const text = entries.map(e => `${e.id}\t${e.text}`).join('\n');
        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage(`已复制 ${entries.length} 条本地化条目到剪贴板`);
    });

    // 扫描当前文件并批量替换命令
    let scanFileDisposable = vscode.commands.registerCommand('localizationTool.scanFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const document = editor.document;
        const config = vscode.workspace.getConfiguration('localizationTool');
        const functionName = config.get<string>('functionName', 'Lang:GetLang');

        // 扫描文件中所有可本地化的字符串
        const scanResults = scanFileForStrings(document, functionName);

        if (scanResults.length === 0) {
            vscode.window.showInformationMessage('未找到需要本地化的文本');
            return;
        }

        // 创建 QuickPick 多选列表
        const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { scanIndex: number }>();
        quickPick.title = `扫描结果 - ${document.fileName}`;
        quickPick.placeholder = '勾选需要本地化的文本，按 Enter 确认，按 Esc 或点击取消按钮关闭';
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;
        quickPick.buttons = [vscode.QuickInputButtons.Back];
        quickPick.items = scanResults.map((result, index) => ({
            label: `行 ${result.line + 1}`,
            description: result.originalMatch,
            detail: `文本: "${result.text}"${result.formatArgs > 0 ? ` (${result.formatArgs} 个格式化参数)` : ''}`,
            scanIndex: index
        }));

        quickPick.show();

        const selectedItems = await new Promise<readonly (vscode.QuickPickItem & { scanIndex: number })[] | undefined>(resolve => {
            quickPick.onDidAccept(() => {
                resolve(quickPick.selectedItems);
                quickPick.hide();
            });
            quickPick.onDidTriggerButton(() => {
                resolve(undefined);
                quickPick.hide();
            });
            quickPick.onDidHide(() => {
                resolve(undefined);
            });
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }

        // 获取选中的扫描结果，按行号从大到小排序（从后往前替换避免行号偏移）
        const selectedResults = selectedItems
            .map(item => scanResults[item.scanIndex])
            .sort((a, b) => {
                if (b.line !== a.line) {
                    return b.line - a.line;
                }
                return b.startChar - a.startChar;
            });

        let currentNextId = config.get<number>('nextId', 1001);
        const entries = config.get<LocalizationEntry[]>('entries', []);

        // 先为每个结果分配 ID（按原始顺序，即行号从小到大），复用已有条目
        const sortedByLineAsc = [...selectedResults].sort((a, b) => {
            if (a.line !== b.line) {
                return a.line - b.line;
            }
            return a.startChar - b.startChar;
        });
        const idMap = new Map<number, number>();
        const reusedSet = new Set<number>();
        const batchTextToId = new Map<string, number>();
        let newIdCounter = currentNextId;
        sortedByLineAsc.forEach((result, idx) => {
            const parameterizedText = replaceFormatPlaceholders(result.text);
            const existingId = findExistingEntryId(entries, result.text);
            if (existingId !== undefined) {
                idMap.set(idx, existingId);
                reusedSet.add(idx);
            } else if (batchTextToId.has(parameterizedText)) {
                idMap.set(idx, batchTextToId.get(parameterizedText)!);
                reusedSet.add(idx);
            } else {
                idMap.set(idx, newIdCounter);
                batchTextToId.set(parameterizedText, newIdCounter);
                newIdCounter++;
            }
        });

        // 批量替换（从后往前）
        await editor.edit(editBuilder => {
            selectedResults.forEach(result => {
                const originalIndex = sortedByLineAsc.indexOf(result);
                const assignedId = idMap.get(originalIndex)!;

                const line = document.lineAt(result.line);
                const afterMatch = line.text.substring(result.endChar);
                const generatedCode = generateLocalizationCode(functionName, assignedId, result.formatArgs, result.text, afterMatch, result.formatArgsStr);

                const replaceRange = new vscode.Range(
                    new vscode.Position(result.line, result.startChar),
                    line.range.end
                );
                editBuilder.replace(replaceRange, generatedCode);
            });
        });

        // 自动保存文件
        await document.save();

        // 仅添加不复用的新条目
        sortedByLineAsc.forEach((result, idx) => {
            if (!reusedSet.has(idx)) {
                const assignedId = idMap.get(idx)!;
                entries.push({
                    id: assignedId,
                    text: replaceFormatPlaceholders(result.text),
                    description: '',
                    filePath: document.uri.fsPath,
                    line: result.line
                });
            }
        });

        // 更新配置
        await config.update('entries', entries, true);
        await config.update('nextId', newIdCounter, true);

        // 刷新视图
        localizationProvider.refresh();
        configProvider.refresh();

        vscode.window.showInformationMessage(`已批量替换 ${selectedResults.length} 条文本，ID: ${currentNextId} - ${currentNextId + selectedResults.length - 1}`);
    });

    // 扫描文件夹并批量替换命令
    let scanFolderDisposable = vscode.commands.registerCommand('localizationTool.scanFolder', async () => {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择要扫描的文件夹'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const config = vscode.workspace.getConfiguration('localizationTool');
        const functionName = config.get<string>('functionName', 'Lang:GetLang');

        // 递归查找文件夹下所有文本文件
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(folderUri[0], '**/*'),
            '**/node_modules/**'
        );

        if (files.length === 0) {
            vscode.window.showInformationMessage('文件夹中没有找到文件');
            return;
        }

        // 扫描所有文件
        interface FolderScanResult {
            fileUri: vscode.Uri;
            fileName: string;
            line: number;
            startChar: number;
            endChar: number;
            text: string;
            formatArgs: number;
            formatArgsStr: string;
            originalMatch: string;
        }

        const allResults: FolderScanResult[] = [];

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在扫描文件夹...',
            cancellable: false
        }, async () => {
            for (const fileUri of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const results = scanFileForStrings(document, functionName);
                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    results.forEach(result => {
                        allResults.push({
                            fileUri: fileUri,
                            fileName: relativePath,
                            line: result.line,
                            startChar: result.startChar,
                            endChar: result.endChar,
                            text: result.text,
                            formatArgs: result.formatArgs,
                            formatArgsStr: result.formatArgsStr,
                            originalMatch: result.originalMatch
                        });
                    });
                } catch {
                    // 跳过无法打开的文件（如二进制文件）
                }
            }
        });

        if (allResults.length === 0) {
            vscode.window.showInformationMessage('未找到需要本地化的文本');
            return;
        }

        // 创建 QuickPick 多选列表
        const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { scanIndex: number }>();
        quickPick.title = `文件夹扫描结果 (${allResults.length} 条)`;
        quickPick.ignoreFocusOut = true;
        quickPick.placeholder = '勾选需要本地化的文本，按 Enter 确认，按 Esc 或点击取消按钮关闭';
        quickPick.canSelectMany = true;
        quickPick.buttons = [vscode.QuickInputButtons.Back];
        quickPick.items = allResults.map((result, index) => ({
            label: `${result.fileName} : 行 ${result.line + 1}`,
            description: result.originalMatch,
            detail: `文本: "${result.text}"${result.formatArgs > 0 ? ` (${result.formatArgs} 个格式化参数)` : ''}`,
            scanIndex: index
        }));

        quickPick.show();

        const selectedItems = await new Promise<readonly (vscode.QuickPickItem & { scanIndex: number })[] | undefined>(resolve => {
            quickPick.onDidAccept(() => {
                resolve(quickPick.selectedItems);
                quickPick.hide();
            });
            quickPick.onDidTriggerButton(() => {
                resolve(undefined);
                quickPick.hide();
            });
            quickPick.onDidHide(() => {
                resolve(undefined);
            });
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }

        // 按文件分组，每个文件内按行号从大到小排序
        const selectedResults = selectedItems.map(item => allResults[item.scanIndex]);
        const fileGroups = new Map<string, FolderScanResult[]>();
        selectedResults.forEach(result => {
            const key = result.fileUri.toString();
            if (!fileGroups.has(key)) {
                fileGroups.set(key, []);
            }
            fileGroups.get(key)!.push(result);
        });

        // 为所有结果按原始顺序分配 ID，复用已有条目
        const allSelectedSorted = [...selectedResults].sort((a, b) => {
            const fileCompare = a.fileName.localeCompare(b.fileName);
            if (fileCompare !== 0) { return fileCompare; }
            if (a.line !== b.line) { return a.line - b.line; }
            return a.startChar - b.startChar;
        });

        let currentNextId = config.get<number>('nextId', 1001);
        const entries = config.get<LocalizationEntry[]>('entries', []);
        const idMap = new Map<FolderScanResult, number>();
        const reusedSet = new Set<FolderScanResult>();
        const batchTextToId = new Map<string, number>();
        let newIdCounter = currentNextId;
        allSelectedSorted.forEach(result => {
            const parameterizedText = replaceFormatPlaceholders(result.text);
            const existingId = findExistingEntryId(entries, result.text);
            if (existingId !== undefined) {
                idMap.set(result, existingId);
                reusedSet.add(result);
            } else if (batchTextToId.has(parameterizedText)) {
                idMap.set(result, batchTextToId.get(parameterizedText)!);
                reusedSet.add(result);
            } else {
                idMap.set(result, newIdCounter);
                batchTextToId.set(parameterizedText, newIdCounter);
                newIdCounter++;
            }
        });

        // 逐文件替换
        for (const [fileUriStr, groupResults] of fileGroups) {
            const fileUri = vscode.Uri.parse(fileUriStr);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });

            // 文件内按行号从大到小排序
            groupResults.sort((a, b) => {
                if (b.line !== a.line) { return b.line - a.line; }
                return b.startChar - a.startChar;
            });

            await editor.edit(editBuilder => {
                groupResults.forEach(result => {
                    const assignedId = idMap.get(result)!;
                    const line = document.lineAt(result.line);
                    const afterMatch = line.text.substring(result.endChar);
                    const generatedCode = generateLocalizationCode(functionName, assignedId, result.formatArgs, result.text, afterMatch, result.formatArgsStr);

                    const replaceRange = new vscode.Range(
                        new vscode.Position(result.line, result.startChar),
                        line.range.end
                    );
                    editBuilder.replace(replaceRange, generatedCode);
                });
            });

            // 自动保存文件
            await document.save();
        }

        // 仅添加不复用的新条目
        allSelectedSorted.forEach(result => {
            if (!reusedSet.has(result)) {
                const assignedId = idMap.get(result)!;
                entries.push({
                    id: assignedId,
                    text: replaceFormatPlaceholders(result.text),
                    description: '',
                    filePath: result.fileUri.fsPath,
                    line: result.line
                });
            }
        });

        // 更新配置
        await config.update('entries', entries, true);
        await config.update('nextId', newIdCounter, true);

        // 刷新视图
        localizationProvider.refresh();
        configProvider.refresh();

        vscode.window.showInformationMessage(`已批量替换 ${selectedResults.length} 条文本（${fileGroups.size} 个文件），ID: ${currentNextId} - ${currentNextId + selectedResults.length - 1}`);
    });

    // 添加本地化引用命令
    let addLangRequireDisposable = vscode.commands.registerCommand('localizationTool.addLangRequire', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const cursorLine = editor.selection.active.line;
        const insertPosition = new vscode.Position(cursorLine, 0);
        const requireLine = 'local Lang = require("Common.MultiLangulageHelper")\n';

        await editor.edit(editBuilder => {
            editBuilder.insert(insertPosition, requireLine);
        });

        vscode.window.showInformationMessage('已添加本地化引用');
    });

    context.subscriptions.push(
        convertDisposable,
        addEntryDisposable,
        editEntryDisposable,
        refreshDisposable,
        clearEntriesDisposable,
        setNextIdDisposable,
        editConfigDisposable,
        addLangRequireDisposable,
        gotoEntryLocationDisposable,
        deleteEntryDisposable,
        copyAllEntriesDisposable,
        scanFileDisposable,
        scanFolderDisposable
    );
}

// 查找已有条目中是否存在相同参数化文本，返回已有 ID 或 undefined
function findExistingEntryId(entries: LocalizationEntry[], rawText: string): number | undefined {
    const parameterizedText = replaceFormatPlaceholders(rawText);
    const existing = entries.find(e => e.text === parameterizedText);
    return existing?.id;
}

// 将 %d、%s 等格式化占位符替换为 {1}、{2}... 形式
function replaceFormatPlaceholders(text: string): string {
    let index = 0;
    return text.replace(/%[dsfq]/g, () => {
        index++;
        return `{${index}}`;
    });
}

// 解析选中的文本
interface ParseResult {
    text: string;
    formatArgs: number;
    formatArgsStr: string;
}

function parseSelectedText(selectedText: string): ParseResult | null {
    const trimmed = selectedText.trim();

    // 匹配 string.format("...", ...) 或 string.format(xxx, ...) 模式
    const formatRegex = /string\.format\s*\(\s*(?:["']([^"']+)["']|([^,\s]+))\s*(?:,\s*([^)]+))?\)/;
    const formatMatch = trimmed.match(formatRegex);
    if (formatMatch) {
        // formatMatch[1] 是带引号的捕获，formatMatch[2] 是不带引号的变量捕获
        const text = formatMatch[1] || formatMatch[2];
        const argsStr = formatMatch[3] || '';
        const args = argsStr.split(',').filter(arg => arg.trim()).length;
        return { text, formatArgs: args, formatArgsStr: argsStr };
    }

    // 匹配 "..." 或 '...' 模式（带引号）
    const stringRegex = /^["'](.+)["']$/;
    const stringMatch = trimmed.match(stringRegex);
    if (stringMatch) {
        return { text: stringMatch[1], formatArgs: 0, formatArgsStr: '' };
    }

    // 匹配纯文本（不带引号），只要不是空字符串
    if (trimmed.length > 0 && !trimmed.includes('(') && !trimmed.includes(')')) {
        return { text: trimmed, formatArgs: 0, formatArgsStr: '' };
    }

    return null;
}

// 生成本地化代码
function generateLocalizationCode(functionName: string, id: number, formatArgs: number, originalText: string, afterSelection: string, formatArgsStr?: string): string {
    let code: string;
    if (formatArgs > 0 && formatArgsStr) {
        code = `${functionName}(${id}, ${formatArgsStr.trim()})`;
    } else if (formatArgs > 0) {
        const args = Array.from({ length: formatArgs }, (_, i) => i + 1).join(', ');
        code = `${functionName}(${id}, ${args})`;
    } else {
        code = `${functionName}(${id})`;
    }
    // 添加注释显示原内容，并保留后面的代码
    return `${code}${afterSelection} -- "${originalText}"`;
}

// 显示确认弹窗
async function showConfirmationDialog(originalText: string, id: number, generatedCode: string): Promise<string | undefined> {
    const message = `生成本地化代码:\n\n原文本: "${originalText}"\nID: ${id}\n生成代码: ${generatedCode}`;

    const result = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        '替换',
        '复制'
    );

    if (result === '替换') {
        return 'confirm';
    }
    if (result === '复制') {
        return 'copy';
    }
    return undefined;
}

// 扫描结果接口
interface ScanResult {
    line: number;
    startChar: number;
    endChar: number;
    text: string;
    formatArgs: number;
    formatArgsStr: string;
    originalMatch: string;
}

// 扫描文件中所有可本地化的字符串
function scanFileForStrings(document: vscode.TextDocument, functionName: string): ScanResult[] {
    const results: ScanResult[] = [];
    const funcNameEscaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\export function deactivate() {}');
    const totalLines = document.lineCount;

    for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
        const lineText = document.lineAt(lineIndex).text;

        // 跳过已本地化的行
        if (lineText.includes(functionName)) {
            continue;
        }

        // 跳过 require/import 语句
        if (/\brequire\s*\(/.test(lineText) || /\bimport\b/.test(lineText)) {
            continue;
        }

        // 跳过注释行
        const trimmedLine = lineText.trim();
        if (trimmedLine.startsWith('--') || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
            continue;
        }

        // 匹配 string.format("...", ...) 模式
        const formatRegex = /string\.format\s*\(\s*["']([^"']+)["']\s*(?:,\s*([^)]+))?\)/g;
        let formatMatch;
        while ((formatMatch = formatRegex.exec(lineText)) !== null) {
            const text = formatMatch[1];
            if (shouldLocalize(text)) {
                const argsStr = formatMatch[2] || '';
                const args = argsStr.split(',').filter(arg => arg.trim()).length;
                results.push({
                    line: lineIndex,
                    startChar: formatMatch.index,
                    endChar: formatMatch.index + formatMatch[0].length,
                    text: text,
                    formatArgs: args,
                    formatArgsStr: argsStr,
                    originalMatch: formatMatch[0]
                });
            }
        }

        // 匹配普通字符串 "..." 或 '...'（排除已被 string.format 匹配的部分）
        const stringRegex = /(?<!string\.format\s*\(\s*)["']([^"']+)["']/g;
        let stringMatch;
        while ((stringMatch = stringRegex.exec(lineText)) !== null) {
            const matchStart = stringMatch.index;
            const matchEnd = matchStart + stringMatch[0].length;

            // 检查是否与已匹配的 string.format 重叠
            const overlaps = results.some(r =>
                r.line === lineIndex && matchStart >= r.startChar && matchStart < r.endChar
            );
            if (overlaps) {
                continue;
            }

            const text = stringMatch[1];
            if (shouldLocalize(text)) {
                results.push({
                    line: lineIndex,
                    startChar: matchStart,
                    endChar: matchEnd,
                    text: text,
                    formatArgs: 0,
                    formatArgsStr: '',
                    originalMatch: stringMatch[0]
                });
            }
        }
    }

    return results;
}

// 判断文本是否需要本地化（包含中文字符）
function shouldLocalize(text: string): boolean {
    // 必须包含中文字符
    if (!/[\u4e00-\u9fff]/.test(text)) {
        return false;
    }
    // 排除纯路径（包含 / 或 . 且看起来像模块路径）
    if (/^[A-Za-z0-9_.\/\\]+$/.test(text)) {
        return false;
    }
    return true;
}

export function deactivate() {}
