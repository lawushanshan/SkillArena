# 基础审计示例

> [English](README.md) | 简体中文

本示例包含三个相互独立的 suite，展示 eval 文件、fixture 和本地 Skill 的关系：安全审计、配置加固和发布说明。

在当前目录运行：

```powershell
skillarena run --dry-run
```

每个 eval 都描述具有可观测产物的任务。各 suite 分别创建审计报告、配置说明或发布说明，且都会保持 `package.json` 不变。fixture 则提供每个 case 执行前会被复制的初始 workspace。

suite 声明的本地 Skill 会在 Codex 执行前复制到每个 case workspace。

真实 Codex 执行是否通过取决于已安装的 Skill 与模型行为。dry-run 只校验项目结构，不调用 Codex。
