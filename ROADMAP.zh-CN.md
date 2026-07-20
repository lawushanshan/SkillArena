# 路线图

> [English](ROADMAP.md) | 简体中文

## v0：Codex Skill Eval Harness

- [x] 选择实现技术栈与包管理器
- [x] 定义项目配置与 eval schema
- [x] 定义 report JSON schema 与 eval case 格式
- [x] 用 `codex exec --json` 运行 prompt
- [x] 捕获 JSONL trace、命令元数据与可复现性元数据
- [x] 实现确定性 grader、解析并归一化 Codex JSONL 事件、分类失败
- [x] 生成 Markdown 和 JSON 报告，支持 CI 退出码
- [x] 添加最小可用示例 eval 项目

## v0.1：A/B 评测

- [x] 比较启用/未启用某个 Skill 的运行
- [x] 比较 Skill 版本 A 与版本 B
- [x] 在可获取时报告触发率、误触发率、通过率、耗时与成本信号

## v0.2：更好的评分

- [x] 增加基于 rubric 的 LLM judge
- [x] 增加预期产物的 snapshot fixture
- [x] 增加失败 trace 摘要

## 后续

- 面向其他编程 Agent 的 adapter interface
- Web report viewer
- 可共享的 benchmark pack

第一个里程碑的非目标：Skill 市场、通用可观测性平台、多 Agent 框架与托管 SaaS。
