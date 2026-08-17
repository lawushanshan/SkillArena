 # SkillArena: 让 Codex Skill 的评测有据可依

 你写了一个 Codex Skill，但你怎么知道它真的有用？

 这个问题困扰了我一段时间。Skill 写好之后，我只能靠人肉测试来验证：给 Codex 一个 prompt，看它有没有选对 Skill，有没有执行预期的命令，有没有生成正确的文件。偶尔改了一下 Skill 的描述，结果整个行为就变了，而我完全不知道。

 这就是 SkillArena 要解决的问题。

 ## SkillArena 是什么

 SkillArena 是一个本地优先的 Codex Skill 评测工具。你用 YAML 定义评测用例，SkillArena 帮你自动化执行、捕获 trace、评分、生成报告。

 它的核心流程很简单：

 ```
 定义 eval case (YAML)
   -> 准备隔离 workspace
   -> 通过 codex exec --json 执行 prompt
   -> 捕获 JSONL trace
   -> 确定性评分 (skill 触发、命令执行、文件变更、退出码)
   -> 生成 Markdown / JSON 报告
 ```

 ## 一个具体的例子

 假设你写了一个 code-audit Skill，你希望验证两件事：

 1. 当用户要求审计代码时，Codex 应该选择这个 Skill 并生成审计报告
 2. 当用户只是要求修改 package.json 时，Codex 不应该触发这个 Skill

 用 SkillArena 的 eval 文件写出来就是：

 ```yaml
 name: code-audit
 agent: codex
 cases:
   - id: creates-audit-report
     prompt: "Review this repository and create audit-report.md."
     workspace:
       fixture: fixtures/security-review
     expect:
       skill_used: code-audit
       files_created:
         - audit-report.md
       commands_succeeded: true

   - id: does-not-trigger-on-unrelated-task
     prompt: "Update the version in package.json to 2.0.0"
     workspace:
       fixture: fixtures/security-review
     expect:
       skill_not_used: code-audit
       files_changed:
         - package.json
 ```

 然后运行：

 ```powershell
 skillarena run
 skillarena report
 ```

 你会得到一份清晰的报告，告诉你每个 case 是 pass 还是 fail，以及失败的原因。

 ## A/B 比较：Skill 改好了还是改差了

 SkillArena 最让我觉得有价值的功能是 A/B 比较。

 当你修改了一个 Skill 之后，你可以运行两次评测，然后用 `skillarena compare` 对比结果：

 ```powershell
 skillarena compare --fail-on-regression
 ```

 它会告诉你：

 - 触发率变化了多少
 - 误触发率变化了多少
 - 通过率变化了多少
 - 哪些 case 改善了，哪些退化了

 这让 Skill 的迭代从"凭感觉"变成了"看数据"。

 ## 设计原则

 SkillArena 的设计有几个刻意的选择：

 **确定性优先** — 先用确定性检查（文件是否创建、命令是否执行、Skill 是否触发），不够用时再引入 LLM-as-judge。确定性检查快、可重复、不花钱。

 **Raw trace 永不丢弃** — 原始的 JSONL trace 始终保留在 `.skillarena/runs/` 下。即使解析器有 bug，你也能手动检查原始数据。

 **隔离 workspace** — 每个 case 都从 fixture 复制一份独立的 workspace。case 之间互不影响，每次运行都是干净的起点。

 **CI 友好** — 退出码反映评测结果，可以直接在 GitHub Actions 里用。

 ## 安装和使用

 ```powershell
 npm install -g skillarena
 skillarena init
 skillarena run
 skillarena report
 ```

 需要 Node.js 20+ 和 PATH 中的 `codex` CLI。

 ## 路线图

 SkillArena v0 聚焦于 Codex。但架构上已经为多 agent 扩展做了准备：

 - `AgentAdapter` 接口已定义，Codex adapter 是参考实现
 - 版本检测通过 adapter 进行，不再硬编码 Codex
 - 归一化的 trace 事件模型与具体 agent 解耦

 下一步计划是添加第二个 adapter（比如 Claude Code）来验证接口设计。

 ## 为什么开源

 Codex Skill 生态还在早期，但已经在生长。我相信 skill 作者需要一个标准化的评测工具，而不是每个人都自己写脚本。SkillArena 的目标是成为这个生态里的"测试基础设施"。

 项目地址：[https://github.com/lawushanshan/SkillArena](https://github.com/lawushanshan/SkillArena)

 欢迎试用、反馈、贡献。
