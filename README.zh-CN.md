# SkillArena

> [English](README.md) | 简体中文

SkillArena 是一个用于评测 Codex Skill 的测试工具。

首个目标刻意保持聚焦：帮助 Codex Skill 作者自动验证 Skill 是否在恰当场景被触发，以及它是否改善了任务结果。

## 范围

SkillArena v0 专注于：

- 通过 `codex exec --json` 运行评测用例
- 捕获结构化 trace
- 检查预期的 Skill 行为是否发生
- 对 Skill 版本进行 A/B 运行比较
- 为本地开发与 CI 生成简洁的通过/失败报告

SkillArena v0 不试图成为通用 Agent 可观测性平台或通用基准测试套件。

## MVP

- 基于 YAML 的 eval 用例
- Codex runner
- JSONL trace parser
- 对 Skill 使用、命令执行、文件与退出状态的确定性评分
- 后续可选的 LLM judge
- Markdown 与 JSON 报告
- 适合 CI 的退出码

## 文档

- [使用指南](docs/USAGE.zh-CN.md)
- [架构](docs/ARCHITECTURE.zh-CN.md)
- [产品与架构评审](docs/PRODUCT-ARCHITECTURE-REVIEW.zh-CN.md)
- [产品形态 ADR](docs/ADR-0001-product-shape.zh-CN.md)
- [技术栈 ADR](docs/ADR-0002-implementation-stack.zh-CN.md)
- [路线图](ROADMAP.zh-CN.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)

## 核心概念

### 什么是 eval？

eval 是针对一个 Codex Skill 的可重复测试定义。它描述要交给 Codex 的任务，以及 SkillArena 在执行后应检查的可观测行为。

它可以回答：Codex 是否选择了预期 Skill、是否避免了不应使用的 Skill、是否运行了预期命令、命令是否成功，以及文件是否按预期创建、修改或保持不变。

### 什么是 eval case？

eval case 是一个 eval suite 中可执行的测试用例，可理解为“任务说明 + 验收条件”。

```yaml
cases:
  - id: creates-audit-report
    prompt: "Review this repository and create audit-report.md."
    workspace:
      fixture: fixtures/security-review
    expect:
      files_created:
        - audit-report.md
      files_deleted:
        - TODO.tmp
      commands_not_run:
        - contains: "npm publish"
      commands_succeeded: true
```

其中，`id` 用于命名用例，`prompt` 是发送给 Codex 的任务，`workspace.fixture` 选择初始项目文件，`expect` 定义通过/失败检查。

### 什么是 fixture 与 workspace？

fixture 是初始工作区模板。SkillArena 会在每次运行前复制它，原始 fixture 不会被 Codex 修改。workspace 则是每个 case 实际运行的独立目录：

```text
fixture 模板
  -> 复制到新的 workspace
  -> Codex 在 workspace 中执行 prompt
  -> SkillArena 比较执行前后的文件状态
  -> 生成报告
```

运行工作区位于 `.skillarena/runs/<run-id>/workspaces/<suite>/<case>/`。即使多个 case 使用同一 fixture，它们也各自拥有独立副本。

## 目标用法

```powershell
skillarena init
skillarena run
skillarena compare
```

开发者以 YAML 编写 eval，用 `codex exec --json` 运行，并在 `.skillarena/runs/` 下查看 Markdown 或 JSON 报告。`skillarena compare --fail-on-regression` 可在 CI 中阻止候选版本引入回归。

## 示例

- [基础审计示例](examples/basic-audit/README.zh-CN.md)

## 当前状态

仓库已提供 TypeScript CLI、项目初始化、eval schema 校验与 dry-run、逐 case workspace、Codex 执行、trace 归一化、确定性评分、工作区 diff 检查，以及 JSON/Markdown 报告。

## 开发

```powershell
npm install
npm run check
npm test
npm run build
```
