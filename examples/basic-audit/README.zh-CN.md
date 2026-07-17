# 基础审计示例

> [English](README.md) | 简体中文

本示例说明 eval 文件与 fixture 的关系。

在当前目录运行：

```powershell
skillarena run --dry-run
```

eval 描述了一个应创建 `audit-report.md`、修改 `README.md`、并保持 `package.json` 不变的任务。fixture 则提供每个 case 执行前会被复制的初始 workspace。

suite 声明的本地 `code-audit` Skill 会在 Codex 执行前复制到每个 case workspace。

真实 Codex 执行是否通过取决于已安装的 Skill 与模型行为。dry-run 只校验项目结构，不调用 Codex。
