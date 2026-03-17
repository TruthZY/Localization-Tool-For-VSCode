# Localization Tool for VS Code 使用指南

## 项目简介

Localization Tool 是一个 VS Code 扩展插件，用于帮助开发者将代码中的硬编码文本（特别是中文字符串）转换为本地化函数调用。该工具支持 Lua 脚本语言，能够自动识别字符串、处理格式化参数，并生成对应的本地化代码。

## 主要功能

- **单文本转换**：选中代码中的字符串，一键转换为本地化函数调用
- **批量扫描**：扫描当前文件或整个文件夹，批量替换可本地化的文本
- **本地化条目管理**：可视化界面管理所有本地化条目
- **智能复用**：自动检测重复文本，复用已有的本地化 ID
- **格式化参数支持**：支持 `string.format` 等格式化字符串的转换

---

## 如何安装

### 方法一：通过 VSIX 文件安装（推荐）

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 点击右上角的 `...` 菜单
4. 选择 **"从 VSIX 安装..."**
5. 选择项目根目录下的 `localization-tool-1.0.0.vsix` 文件
6. 安装完成后重启 VS Code

### 方法二：通过构建脚本安装

1. 确保已安装 Node.js（建议版本 16.x 或更高）
2. 在项目根目录下运行 `build.bat`
3. 脚本会自动编译并打包生成 `.vsix` 文件
4. 按照方法一安装生成的 `.vsix` 文件

### 方法三：开发模式安装

1. 克隆或下载项目源码
2. 在项目根目录执行：
   ```bash
   npm install
   npm run compile
   ```
3. 按 `F5` 启动调试，或按 `Ctrl+Shift+P` 选择 **"Developer: Install Extension from Location"**

---

## 快速上手

### 1. 基础使用：转换单个文本

1. 在编辑器中选中一段包含中文的字符串（如 `"欢迎使用"`）
2. 右键点击，选择 **"转换为本地化代码"**
3. 在弹出的确认框中查看生成的代码
4. 点击 **"替换"** 直接替换原文本，或点击 **"复制"** 仅复制到剪贴板

**示例转换：**
```lua
-- 转换前
print("欢迎使用游戏")

-- 转换后
print(Lang:GetLang(1001)) -- "欢迎使用游戏"
```

### 2. 添加本地化引用

在需要使用本地化的文件中：
1. 右键点击编辑器空白处
2. 选择 **"添加本地化引用"**
3. 插件会自动在光标所在行插入：
   ```lua
   local Lang = require("Common.MultiLangulageHelper")
   ```

### 3. 批量扫描文件

1. 右键点击编辑器空白处
2. 选择 **"扫描当前文件并批量本地化"**
3. 插件会扫描文件中所有包含中文的字符串
4. 在弹出的列表中勾选需要本地化的条目
5. 按 Enter 确认，插件会自动替换所有选中的文本

### 4. 批量扫描文件夹

1. 右键点击编辑器空白处
2. 选择 **"扫描文件夹并批量本地化"**
3. 选择要扫描的文件夹
4. 在弹出的列表中勾选需要本地化的条目（显示文件名和行号）
5. 按 Enter 确认，插件会自动处理所有选中的文件

### 5. 管理本地化条目

安装插件后，左侧活动栏会出现 **"本地化工具"** 图标（地球图标）：

- **配置面板**：显示当前 ID 计数器，点击可修改
- **本地化条目面板**：显示所有已创建的本地化条目
  - 点击条目可跳转到对应代码位置
  - 点击编辑按钮可修改条目文本和描述
  - 点击删除按钮可删除条目
  - 点击刷新按钮可刷新列表
  - 点击复制按钮可复制所有条目到剪贴板

---

## 配置说明

插件支持以下配置项（可通过 VS Code 设置修改）：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `localizationTool.nextId` | 1001 | 下一个生成的本地化 ID |
| `localizationTool.functionName` | `Lang:GetLang` | 本地化函数名称 |
| `localizationTool.entries` | [] | 本地化条目列表（自动维护） |

**修改配置方法：**
1. 按 `Ctrl+,` 打开设置
2. 搜索 "Localization Tool"
3. 修改相应配置项

---

## 注意事项

> **此部分由用户自行补充**
>
> 建议包含以下内容：
> - 使用限制和已知问题
> - 特定语言或框架的注意事项
> - 数据备份建议
> - 与其他插件的兼容性说明
> - 性能相关提示

---

## 如何部署环境并开发

### 环境要求

- **Node.js**: 16.x 或更高版本
- **VS Code**: 1.74.0 或更高版本
- **TypeScript**: 4.9.4 或更高版本

### 开发环境搭建

1. **克隆项目**
   ```bash
   git clone https://github.com/yourusername/localization-tool.git
   cd localization-tool
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **编译项目**
   ```bash
   npm run compile
   ```

4. **启动调试**
   - 在 VS Code 中打开项目
   - 按 `F5` 启动扩展开发宿主
   - 在新窗口中测试插件功能

### 项目结构

```
vscode-localization-tool/
├── src/                          # 源代码目录
│   ├── extension.ts              # 主入口文件，包含所有命令实现
│   ├── localizationEntry.ts      # 本地化条目数据模型
│   ├── localizationProvider.ts   # 本地化条目树形视图提供者
│   └── configProvider.ts         # 配置面板树形视图提供者
├── out/                          # 编译输出目录（自动生成）
├── node_modules/                 # 依赖包目录
├── package.json                  # 扩展配置和依赖声明
├── tsconfig.json                 # TypeScript 编译配置
├── build.bat                     # Windows 构建脚本
└── localization-tool-1.0.0.vsix  # 打包好的扩展文件
```

### 核心文件说明

#### extension.ts
主入口文件，实现了以下功能：
- `convertText`: 转换选中文本为本地化代码
- `scanFile`: 扫描当前文件批量本地化
- `scanFolder`: 扫描文件夹批量本地化
- `addLangRequire`: 添加本地化引用语句
- 条目管理：添加、编辑、删除、清空本地化条目

#### localizationEntry.ts
定义本地化条目数据结构：
```typescript
class LocalizationEntry {
    id: number;           // 本地化 ID
    text: string;         // 原文本
    description: string;  // 描述
    filePath?: string;    // 关联文件路径
    line?: number;        // 关联行号
}
```

#### localizationProvider.ts
实现本地化条目的树形视图展示，支持：
- 显示所有本地化条目
- 点击跳转到代码位置
- 刷新视图

#### configProvider.ts
实现配置面板的树形视图展示，支持：
- 显示当前 ID 计数器
- 点击修改配置

### 开发调试

1. **修改代码后**：按 `Ctrl+Shift+B` 编译，或运行 `npm run watch` 自动监视
2. **调试**：按 `F5` 启动调试会话
3. **查看日志**：在调试控制台查看 `console.log` 输出

### 打包发布

1. **安装 vsce 工具**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **打包扩展**
   ```bash
   vsce package
   ```

### 技术细节

#### 支持的文本模式

插件可以识别以下模式的文本：

1. **普通字符串**：`"欢迎使用"` 或 `'欢迎使用'`
2. **格式化字符串**：`string.format("欢迎 %s", name)`
3. **纯文本**：直接选中的无引号文本

#### 本地化代码生成规则

- 无参数：`Lang:GetLang(1001)`
- 有参数：`Lang:GetLang(1001, arg1, arg2)`
- 格式化占位符转换：`%s`, `%d` → `{1}`, `{2}`

#### 扫描规则

扫描时会自动跳过：
- 已包含本地化函数的行
- `require` 和 `import` 语句
- 注释行（以 `--`, `//`, `#` 开头）
- 不包含中文字符的字符串
- 看起来像模块路径的字符串

---

## 问题反馈

如有问题或建议，请通过以下方式反馈：
- 在 GitHub 仓库提交 Issue
- 联系项目维护者
