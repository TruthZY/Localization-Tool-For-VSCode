import * as vscode from 'vscode';

export class ConfigItem {
    constructor(
        public label: string,
        public value: string,
        public key: string,
        public description?: string
    ) {}
}

export class ConfigProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | null | void> = new vscode.EventEmitter<ConfigItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConfigItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            element.label,
            vscode.TreeItemCollapsibleState.None
        );

        treeItem.description = element.value;
        treeItem.tooltip = element.description || `${element.label}: ${element.value}`;
        treeItem.command = {
            command: 'localizationTool.editConfig',
            title: '编辑配置',
            arguments: [element]
        };

        return treeItem;
    }

    getChildren(): Thenable<ConfigItem[]> {
        const config = vscode.workspace.getConfiguration('localizationTool');
        const nextId = config.get<number>('nextId', 1001);
        const functionName = config.get<string>('functionName', 'Lang:GetLang');

        return Promise.resolve([
            new ConfigItem('当前ID', nextId.toString(), 'nextId', '点击修改下一个生成的本地化ID'),
        ]);
    }
}
