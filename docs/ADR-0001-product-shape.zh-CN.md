# ADR 0001：产品形态

> [English](ADR-0001-product-shape.md) | 简体中文

## 状态

已接受。

## 背景

SkillArena 需要明确的产品形态。可选方向包括 Codex Skill、Codex Plugin、独立可安装 CLI 包或托管 Web 服务。其首要目标要求运行 eval、调用 Codex、捕获 trace、检查 workspace、评分并输出报告。

## 决策

SkillArena v0 是独立、可安装的 CLI 包：

```powershell
skillarena init
skillarena run
skillarena report
```

CLI 是产品本体，可在本地和 CI 使用。

## 原因

Codex Skill 适合在 Agent 会话内协助完成任务；SkillArena 则需要围绕 Codex 编排可重复运行、隔离 workspace、执行 `codex exec --json`、保存原始 trace、检查文件改动、评分并生成报告。这些职责更适合作为 CLI。

Plugin 在 CLI 成熟后可作为便利层，提供命令、帮助编写 eval 的 Skill 或打包能力，但不应成为 v0 的执行基础。托管服务会过早引入账号、远程执行、存储、计费、密钥与安全成本，因此暂不采用。

## 结果

v0 优先提供可靠 CLI、稳定 eval 格式、Codex adapter、本地运行目录、JSON/Markdown 报告和 CI 退出码。未来可增加辅助作者的 Skill、Plugin、Web viewer 或其他 Agent adapter；核心引擎不应依赖任何单一包装形态。
