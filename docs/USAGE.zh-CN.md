# 使用指南

> [English](USAGE.md) | 简体中文

本文说明 SkillArena v0 的开发者体验与当前已实现的工作流。

## 适用对象

SkillArena 面向维护 Codex Skill 的开发者，用于回答：Skill 是否应触发时触发、不应触发时避免触发、是否带来预期的命令/文件结果，以及新版本是否改善或回归。

## 工作流

```text
1. 安装 SkillArena
2. 在 Skill 项目中初始化 eval 文件
3. 用 YAML 编写 eval case
4. 在本地运行 eval
5. 查看 Markdown 与 JSON 报告
6. 将 eval 命令接入 CI
```

## 安装与初始化

SkillArena 是 Node.js/TypeScript CLI，发布后的目标安装方式为：

```powershell
npm install -g skillarena
```

在包含 Codex Skill 的项目根目录运行：

```powershell
skillarena init
```

它会创建（但不会覆盖现有文件）：

```text
skillarena.yaml
evals/
  sample-audit.yaml
fixtures/
  sample-workspace/
    README.md
    package.json
    src/app.js
.skillarena/
  runs/
```

生成的示例覆盖文件创建、修改、删除与保持不变等断言。

## 示例项目

仓库包含完整示例 `examples/basic-audit/`，其中有 `skillarena.yaml`、`evals/code-audit.yaml` 与 `fixtures/security-review/`。它展示 eval 文件与 fixture 的关系。

## 编写 eval case

每个 eval 文件描述 prompt 和执行后可观察的行为：

如果 suite 声明了 `skill`，其 `path` 必须指向包含 `SKILL.md` 的目录。SkillArena 会在调用
Codex 前把该目录复制到每个隔离 case workspace 的 `.codex/skills/<skill-name>/`；运行不会修改
源 Skill 或 fixture。

```yaml
name: markdown-skill
agent: codex
cases:
  - id: creates-table-of-contents
    prompt: "Add a table of contents to README.md."
    workspace:
      fixture: fixtures/markdown-basic
    expect:
      skill_used: markdown
      files_changed:
        - README.md
      commands_succeeded: true

  - id: does-not-trigger-for-unrelated-task
    prompt: "List the files in this repository."
    workspace:
      fixture: fixtures/markdown-basic
    expect:
      skill_not_used: markdown
      commands_not_run:
        - contains: "npm publish"
      commands_succeeded: true
```

支持的字段：

- `id`、`prompt`、`workspace.fixture`
- `expect.skill_used`、`expect.skill_not_used`
- `expect.commands`、`expect.commands_not_run`
- `expect.commands_succeeded`、`expect.exit_code`
- `expect.files_created`、`expect.files_changed`、`expect.files_deleted`、`expect.files_unchanged`
- `expect.file_snapshots`
- `expect.judge`

`commands` 与 `commands_not_run` 中的每项必须包含 `contains` 或 `exact`；`commands` 可额外用 `exit_code` 限制命令退出码。

`file_snapshots` 将 workspace 中生成的文件与配置 `paths.snapshots` 目录下的文件按字节精确比较。每项的
`snapshot` 都相对于该目录：

```yaml
paths:
  snapshots: snapshots

# eval case 内
expect:
  file_snapshots:
    - path: audit-report.md
      snapshot: code-audit/audit-report.md
```

运行开始前 snapshot 必须已存在；缺失属于配置错误，内容不一致会以 `artifact_mismatch` 使 case 失败。仅应对稳定产物使用该断言。

## Rubric judge

当确定性断言不足以评价产物质量时，可使用 `expect.judge`。judge 会对每个标准给出 0 到 100 的分数，并将加权总分与 `min_score` 比较：

```yaml
expect:
  files_created:
    - audit-report.md
  judge:
    min_score: 80
    files:
      - audit-report.md
    rubric:
      - criterion: actionable-findings
        description: "报告给出具体风险与可执行的修复建议。"
        weight: 2
      - criterion: scope
        description: "报告仅基于工作区中的证据。"
        weight: 1
```

仅 `judge.files` 显式列出的相对 workspace 文件会作为证据发送；单个文件与全部证据都有长度上限。未声明 `expect.judge` 的 case 不会调用 OpenAI。

执行 judged case 时，通过环境变量提供密钥，并通过命令行或环境变量明确指定模型：

```powershell
$env:OPENAI_API_KEY = "..."
skillarena run --judge-model <model-id>

$env:SKILLARENA_JUDGE_MODEL = "<model-id>"
skillarena run
```

`--judge-timeout-ms <ms>` 控制每个 OpenAI 请求的超时，默认 `60000`。`--dry-run` 只校验 judge schema 和 artifact 路径，不调用 OpenAI。缺少密钥或模型、API 错误、超时、结构化输出无效，或总分低于 `min_score`，都会以 `judge_failed` 仅使对应 case 失败。

## 运行 eval

`--dry-run` 会加载项目配置、校验 YAML、复制 fixture、记录元数据并生成报告，不调用 Codex。普通 `run` 则会为每个 case 创建隔离 workspace、运行 `codex exec --json`、保存 raw JSONL/stderr、解析 trace、比较文件快照并评分。

```powershell
# 运行所有 eval
skillarena run

# 指定 eval 文件、suite 或 case
skillarena run evals/markdown-skill.yaml
skillarena run --suite markdown-skill
skillarena run evals/markdown-skill.yaml --case creates-table-of-contents

# 限制 case 数量，或在第一次失败时停止
skillarena run --max-cases 5
skillarena run --fail-fast

# 仅验证配置和 workspace
skillarena run --dry-run
```

默认情况下，报告写入后会清理逐 case workspace；原始 JSONL、stderr、归一化 trace 和报告会始终保留。需要检查工作区最终文件时，使用 `--keep-workspace`：

```powershell
skillarena run --case creates-table-of-contents --keep-workspace
skillarena run --dry-run --keep-workspace
```

可通过 `--timeout-ms <ms>` 设置单个 case 的超时，默认值为 `300000`；通过 `--codex-command <command>` 指定 Codex 可执行命令。传入 Codex 可执行文件的绝对路径时，SkillArena 会同时将其所在目录加入 Codex 子进程的 `PATH`，以便 Skill 使用同目录附带的工具。

当前执行路径会评分进程超时/退出码、原始与解析 trace 可用性、Skill 正反触发、命令正反断言、命令成功状态，以及四类工作区文件断言。

Codex adapter 当前声明 `skill_read_trace`、`command_trace` 和 `file_change_detection`。runner 会在执行前从 case 断言推导所需能力；若能力不可用，对应检查标记为 `unsupported`，case 与 suite 标记为 `blocked`，命令以非零退出码结束。

## 评测带脚本的 Skill

SkillArena 不直接执行嵌入 Skill 的脚本。端到端评测中，Codex 必须自行决定是否按 Skill 指令运行脚本，SkillArena 只观察并评分。这能发现“读了 Skill 却未遵循脚本”“参数错误”以及“脚本成功但结果无改善”等问题。

```yaml
expect:
  skill_used: code-audit
  commands:
    - contains: "node scripts/audit.js"
      exit_code: 0
  files_created:
    - audit-report.md
```

## 比较 Skill 版本

运行两次后可比较保存的报告：

```powershell
skillarena compare
skillarena compare <baseline-run-id> <candidate-run-id>
skillarena compare .skillarena/runs/<baseline-run-id> .skillarena/runs/<candidate-run-id>
skillarena compare --json
skillarena compare --fail-on-regression
```

若未提供目录，`compare` 取运行目录中最新两次报告。输出包括 `improved`、`regressed`、`mixed` 或 `unchanged` verdict、通过率、触发率、误触发率、case 状态变化和耗时。使用 `--fail-on-regression` 时，任何负向信号或 `mixed` 都使命令以退出码 1 结束。

默认情况下，SkillArena 只比较运行模式、项目配置 hash、eval hash、fixture hash 和所选 suite/case 集合完全相同的两次运行。这样可避免将 dry-run、变更后的基准或部分 case 选择误报为 Skill 改进。Skill source hash 的变化是 A/B 评测的预期输入，会显示在结果中；Codex、Node 或平台变化会显示为警告，因为它们可能影响 Agent 行为。

仅排查时，可显式比较不兼容报告：

```powershell
skillarena compare <baseline-run-id> <candidate-run-id> --allow-incompatible
```

不应将不兼容比较作为 CI 回归门禁。应先使用相同的 eval 与 fixture 版本创建 baseline，只修改 Skill 源码后再运行 candidate。

## 报告与排障

每次运行会在 `.skillarena/runs/<run-id>/` 下写入：

```text
workspaces/<suite>/<case>/  # 仅在使用 --keep-workspace 时保留
raw/<suite>__<case>.jsonl
raw/<suite>__<case>.stderr.txt
parsed/<suite>__<case>.json
report.json
report.md
```

`report.json` 是自动化契约，`report.md` 面向人工阅读。报告包含 SkillArena、Node、平台、Codex 版本（可检测时）、配置/eval/fixture/Skill hash 等可复现性元数据。

重新渲染最近一次或指定运行的 Markdown 报告：

```powershell
skillarena report
skillarena report .skillarena/runs/<run-id>
```

调试失败时，依次查看控制台摘要、`report.md` 中 case 下的失败 trace 摘要、`parsed/` 下归一化 trace、`raw/` 下原始 JSONL 与 stderr。若运行时使用了 `--keep-workspace`，还可检查保存的 workspace。

失败摘要会展示首要失败类别、已读取的 Skill、非零退出命令、运行错误和 JSONL 解析错误位置。它刻意不复制命令输出、assistant 消息或原始解析错误文本；需要这些细节时再查看保存的 artifact。

## CI 与本地安全

当没有失败或 blocked case 时，`run` 和 `report` 以退出码 0 结束；否则返回非零。`compare --fail-on-regression` 仅在检测到回归时失败。

仓库中的 `Verify` 工作流会在每个 pull request 上执行类型检查、单元测试、构建和示例项目的 dry-run；它不会调用 Codex，也不需要凭据。

真实 Codex eval 仅能在手动触发 `Verify` 并设置 `run_real_evals=true` 时运行，且只会在已完成 Codex 安装和认证的自托管 runner 上执行。若 `codex` 不在 runner 的 `PATH` 中，可设置仓库变量 `SKILLARENA_CODEX_COMMAND` 为 Codex 可执行文件的绝对路径。该工作流会保留运行产物供审阅。请勿在 pull request 工作流中配置长期 Codex 凭据；真实评测需要网络访问，并可能产生模型使用成本。

v0 始终复制 fixture 到逐 case 运行目录，不会直接在源项目中运行。但它不是不受信任代码的安全沙箱：Codex 认证、网络与本地执行权限需由运行环境单独配置。原始 trace 可能包含 prompt、命令输出或敏感信息，分享前应先审阅。
