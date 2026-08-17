 # 贡献指南

> [English](CONTRIBUTING.md) | 简体中文

感谢你关注 SkillArena！本项目遵循 [行为准则](CODE_OF_CONDUCT.md)，参与前请先阅读。

SkillArena 是一个专注于评测 Codex Skill 的开发者工具。

## 开发原则

- v0 保持聚焦于 Codex。
- 在 LLM-as-judge 评分之前优先使用确定性检查。
- 将 trace 视为一等数据。
- 让失败能够在本地轻松复现。
- 在 Codex 路径得到验证之前，不引入框架式抽象。

## 快速开始

```powershell
git clone https://github.com/lawushanshan/SkillArena.git
cd SkillArena
npm install
npm run build
npm test
```

## 开发命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 通过 `tsx` 以开发模式运行 CLI |
| `npm run check` | 仅做类型检查，不输出文件 |
| `npm run build` | 编译 TypeScript 到 `dist/` |
| `npm test` | 运行 Vitest 测试套件 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run lint` | 检查 lint 和格式 (Biome) |
| `npm run lint:fix` | 自动修复 lint 和格式问题 |
| `npm run format` | 格式化源文件 |

## 代码风格

SkillArena 使用 [Biome](https://biomejs.dev/) 进行 lint 和格式化。提交前请运行 `npm run lint:fix` 以确保通过 CI。

主要约定：

- TypeScript strict 模式
- ESM 模块（`"type": "module"`）
- 2 空格缩进、双引号、分号、尾逗号
- CLI 层保持精简，业务逻辑放在 `src/core/`
- 确定性 grader 优先于 LLM-as-judge
- 每个新行为都应附带测试

## 建议流程

1. 先开 issue 描述 eval 或功能缺口。
2. Fork 仓库并从 `main` 创建分支。
3. 保持 pull request 小而对应一个行为。
4. 改变 grader 行为时，新增或更新 eval fixture。
5. 确保 `npm run check`、`npm test`、`npm run lint` 全部通过。
6. 如果变更影响用户行为，更新文档。
7. 在 PR 中写明用于验证变更的命令。

## 报告 Bug

使用 [bug report 模板](.github/ISSUE_TEMPLATE/bug_report.md)，并包含：

- eval case、命令、相关 trace 或报告输出
- 操作系统、Codex 版本、SkillArena 版本或 commit
