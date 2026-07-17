# 产品与架构评审

> [English](PRODUCT-ARCHITECTURE-REVIEW.md) | 简体中文

本文记录 SkillArena 文档中曾未完全明确的产品与架构缺口。项目方向正确：v0 应是评测 Codex Skill 的独立 CLI；剩余工作主要是把这个方向落实为可靠、可复现的产品契约。

## 产品缺口

### 1. 目标用户

初期应明确服务三类用户：发布前验证本地 Skill 的个人作者、在 pull request 中评审 Skill 变化的团队维护者、维护共享 Skill 包的平台/工具团队。三者分别需要快速本地反馈与保留 workspace、CI 退出码和易读报告、以及 A/B 比较、回归历史与兼容性检查。

### 2. Skill 发现

v0 推荐由配置或 eval 显式声明 Skill 路径，而不是自动扫描：

```yaml
skill:
  name: markdown
  path: .codex/skills/markdown
```

后续再决定 `--skill`、项目目录发现或全局 Codex Skill 支持。

### 3. Eval 项目模型

项目根目录契约应固定为 `skillarena.yaml`、`evals/`、`fixtures/`、`.skillarena/runs/`。配置文件提供默认值，单个 eval 只在需要时覆盖。

### 4. 可复现性

Agent 行为会受模型、Codex 版本和环境影响。报告至少应记录 SkillArena/Codex/adapter 版本、eval/Skill/fixture hash、操作系统与 shell、开始时间与耗时、命令参数和环境变量 allowlist。

### 5. 凭证与环境

v0 不管理 Codex 登录。运行前应检查 `codex` 是否可用；CI 必须单独配置认证；报告只应记录 allowlist 中的环境变量，防止泄漏密钥。

### 6. 本地安全与不受信任代码

eval 不应直接在源仓库中运行，必须复制 fixture 到逐 case 运行目录，并有默认超时、可配置输出上限、失败 workspace 保留和已知 secret 脱敏策略。v0 不是安全沙箱；Docker、网络控制和资源限制属于后续能力。

### 7. 评分语义

case 有多个检查项，状态可以是 `pass`、`fail` 或 `unsupported`；任一必需检查失败则 case 失败，缺少必需 adapter capability 则 blocked；任一必需 case 失败或 blocked 则 suite 失败。可选检查只发出警告。

### 8. 负例与误触发

`skill_not_used` 应是第一等能力。坏 Skill 的过度触发会降低无关任务的质量，因此需要触发率、误触发率、漏触发率和通过率等指标。

### 9. 失败分类

报告应分类，而不仅是展示断言失败：`setup_error`、`adapter_error`、`timeout`、`skill_not_triggered`、`skill_misfire`、`command_failed`、`artifact_mismatch` 与 `judge_failed`。

### 10. Trace 格式稳定性

Codex JSONL 可能演进。应保存原始 trace、用归一化事件评分、维护真实 raw trace fixture、优雅处理未知事件、声明 adapter capability，并对归一化 report schema 进行版本化。

### 11. Report schema 版本化

`report.json` 是长期兼容契约，应从第一版起包含 `schemaVersion`、`tool`、`run`、`summary` 和 case 数据，并以显式版本演进。

### 12. 技术栈与发布

该决策已由 ADR-0002 固化：v0 使用 Node.js、TypeScript 与 npm。产品不应维护两条并行的 Python/npm 发布入口。

### 13. CI 现实

CI 依赖 Codex 可执行文件、认证、网络、模型权限与成本，不能承诺开箱即用。文档应强调本地优先，CI 需自行配置认证，并确保 setup 失败时也能输出报告。

### 14. 成本与耗时控制

v0 应提供 `--case`、`--suite`、`--fail-fast`、`--timeout-ms`、`--max-cases` 与 `--dry-run`。预算上限、并行度和历史成本比较留待后续。

### 15. Fixture 策略

fixture 是 `fixtures/` 下的普通目录，每个 case 独立复制；应避免过大的 fixture，snapshot 断言应显式选择启用。

### 16. 配置优先级

优先级必须可预测：

```text
CLI flags > eval file > skillarena.yaml > built-in defaults
```

### 17. 隐私与数据处理

artifact 默认只保存在本地，不上传。必须提醒用户 raw trace 可能含 prompt、文件内容、命令输出和密钥；控制台和 Markdown 可做常见 secret 脱敏，但保留完整 raw trace 以便调试，并在分享前警示用户审阅。

### 18. 兼容性矩阵

应列出已测试的操作系统、Node.js 版本、Codex CLI 版本和 shell。

### 19. 不过早抽象的扩展性

Codex adapter 完整跑通前，不实现第二个 adapter 抽象。现在保留清晰边界和接口方向即可，具体实现保持直接。

### 20. 成功标准

v0 应至少评测 3 个真实 Codex Skill、每个 Skill 至少 10 个 case，能够检出漏触发、误触发、命令失败和 artifact mismatch；报告应足以让作者无需手工重跑即可定位问题，并在 Windows 与 Linux 运行。

## 已完成的关键决策

实现栈、项目配置/schema、report schema、Codex adapter 输入输出、隔离 workspace、元数据收集、失败分类和最小示例已经形成代码基础。后续应优先补充真实 Codex trace fixture、capability 检查、完整安全/隐私契约、兼容性矩阵以及真实 Skill 的 eval 覆盖。
