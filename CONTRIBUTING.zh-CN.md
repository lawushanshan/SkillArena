# 贡献指南

> [English](CONTRIBUTING.md) | 简体中文

SkillArena 是一个聚焦于评测 Codex Skill 的开发者工具。

## 开发原则

- v0 保持聚焦于 Codex。
- 在 LLM-as-judge 评分之前优先使用确定性检查。
- 将 trace 视为一等数据。
- 让失败能够在本地轻松复现。
- 在 Codex 路径得到验证前，不引入框架式抽象。

## 建议流程

1. 创建 issue 描述 eval 或功能缺口。
2. 保持 pull request 小且只对应一个行为。
3. 改变 grader 行为时，新增或更新 eval fixture。
4. 在 PR 中写明用于验证变更的命令。
