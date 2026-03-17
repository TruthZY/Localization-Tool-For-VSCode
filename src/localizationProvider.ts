import * as vscode from 'vscode';
import { LocalizationEntry } from './localizationEntry';

export class LocalizationProvider implements vscode.TreeDataProvider<LocalizationEntry> {
    private _onDidChangeTreeData: vscode.EventEmitter<LocalizationEntry | undefined | null | void> = new vscode.EventEmitter<LocalizationEntry | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LocalizationEntry | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LocalizationEntry): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            `${element.id}\t${element.text}`,
            vscode.TreeItemCollapsibleState.None
        );

        treeItem.tooltip = `ID: ${element.id}\n文本: ${element.text}\n描述: ${element.description || '无'}\n文件: ${element.filePath || '无'}\n行号: ${element.line !== undefined ? element.line + 1 : '无'}`;
        treeItem.contextValue = 'entry';

        // 点击跳转到代码位置
        if (element.filePath && element.line !== undefined) {
            treeItem.command = {
                command: 'localizationTool.gotoEntryLocation',
                title: '跳转到代码位置',
                arguments: [element]
            };
        }

        return treeItem;
    }

    getChildren(): Thenable<LocalizationEntry[]> {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const entries = config.get<LocalizationEntry[]>('entries', []);

        return Promise.resolve(
            entries.map(e => new LocalizationEntry(e.id, e.text, e.description, e.filePath, e.line))
        );
    }
}
