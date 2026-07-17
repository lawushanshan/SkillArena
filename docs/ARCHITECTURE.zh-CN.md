# SkillArena 架构

> [English](ARCHITECTURE.md) | 简体中文

SkillArena 是面向 Codex Skill 的本地优先评测工具。v0 只回答一个核心问题：这个 Codex Skill 是否在正确场景触发，并改善任务结果？

## 系统概览

```text
Eval Suite (YAML)
  -> CLI / Runner (skillarena run)
  -> Codex Adapter (codex exec --json)
  -> Trace Store (JSONL)
  -> Trace Parser + Workspace Inspector
  -> Deterministic Grader
  -> JSON / Markdown Reporters
```

## 核心数据流

1. 开发者在 `evals/*.yaml` 编写 eval case。
2. CLI 加载并校验 suite，创建独立运行目录。
3. 每个 case 的 fixture 和已声明本地 Skill 被复制到独立 workspace。
4. Codex adapter 在该 workspace 中执行 `codex exec --json`。
5. 原始 JSONL 和 stderr 不经修改保存。
6. trace parser 将 Codex 事件归一化为内部事件模型。
7. workspace inspector 对比执行前后文件状态。
8. grader 根据断言生成确定性检查结果。
9. reporters 输出可读的 Markdown 和机器可读的 JSON。
10. 失败或 blocked case 会使 CI 返回非零退出码。

## 组件职责

### CLI

CLI 只负责参数解析、调用应用服务与输出结果。当前命令为 `skillarena init`、`skillarena run`、`skillarena report`、`skillarena compare`。

### Eval Loader

读取并校验 YAML，必须在任何 Codex 进程启动前发现 schema 问题。eval 描述 prompt、fixture 和 `expect` 断言。

### Codex Adapter

唯一负责调用 Codex 的边界。它构建命令行、设置工作目录、处理超时、捕获退出状态、保存 raw JSONL 与 stderr。v0 使用 `codex exec --json`，不应在其他位置直接调用 `codex`。

### Skill Provisioning

eval suite 声明 `skill.name` 和 `skill.path` 时，`skill.path` 必须是含 `SKILL.md` 的目录。SkillArena
会将该目录复制到每个隔离 workspace 的 `.codex/skills/<skill-name>/`。这样被评测的 Skill 与 case
保持本地隔离，源 Skill 不会被修改，也无需替换用户的 `CODEX_HOME`、认证或全局配置。

### Trace Store 与 Trace Parser

原始 trace 先于解析保存，确保 parser 缺陷也能排查。运行目录结构为：

```text
.skillarena/runs/<run-id>/
  workspaces/<suite>/<case>/
  raw/<suite>__<case>.jsonl
  raw/<suite>__<case>.stderr.txt
  parsed/<suite>__<case>.json
  report.json
  report.md
```

parser 使用小而稳定的归一化事件集；未知事件保留为 `unknown`，非法 JSONL 行记录为 parse error，不会让整次运行崩溃。当前事件包括 `skill_read`、`command_started`、`command_finished`、`file_read`、`file_changed`、`assistant_message`、`run_error` 和 `unknown`。

### Workspace Inspector

在 Codex 执行前后扫描 workspace 并为文件计算 hash，得到 created、changed、deleted、unchanged 列表。它为文件断言提供确定性依据。

### Grader

v0 优先使用确定性检查：进程退出、Skill 是否读到、命令是否执行或被禁止、命令是否成功，以及文件创建/修改/删除/不变。grader 面向归一化事件和 workspace diff，而非直接依赖 Codex 的原始字段。LLM judge 是后续能力，不是可靠 v0 的前提。

### Reporters

`report.json` 是自动化兼容性契约，`report.md` 面向人工阅读。报告包含 run 元数据、suite/case 状态、检查结果、workspace 和 trace artifact 路径及警告。

## 内部接口与 Adapter 边界

```text
EvalSuite -> Runner -> AgentAdapter -> RawTrace
RawTrace -> TraceParser -> ParsedRun
ParsedRun + WorkspaceState + EvalCase -> Grader -> CaseResult
CaseResult[] -> Reporter -> Report
```

v0 只支持 Codex，但核心不应依赖 Codex 特定字段。未来 adapter 应负责构造调用、环境准备、原始输出和进程元数据捕获、事件归一化或路由，以及能力报告；核心只依赖“是否读到 Skill、哪些命令开始/结束、文件变化、最终消息、超时或失败”等行为。

未来 adapter 可声明 `skill_read_trace`、`command_trace`、`file_read_trace`、`file_change_detection`、`token_usage`、`cost_usage` 和 `structured_final_output` 等 capability。若 eval 需要某能力而 adapter 不支持，应及早标记为 blocked，而不是静默给出不可靠结果。

## 设计原则与非目标

- Codex 优先，adapter 后置。
- 原始 trace 永不丢弃。
- 先确定性评分，后主观 judge。
- 每次失败都应可在本地复现。
- 报告同时服务终端用户与 CI。
- 在 Codex 路径端到端稳定前，不为未来扩展过早抽象。

v0 不支持其他编程 Agent、托管执行、多用户仪表盘、Skill 市场、复杂 LLM judge 工作流或通用可观测性平台功能。对于带脚本的 Skill，SkillArena 不会绕过 Agent 直接运行脚本；它评测的是 Agent 是否选择并正确遵循该 Skill。
