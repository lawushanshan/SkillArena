# ADR 0002：实现技术栈

> [English](ADR-0002-implementation-stack.md) | 简体中文

## 状态

已接受。

## 背景

SkillArena v0 是独立 CLI 包，实现技术栈需要让本地安装、CI、JSON/YAML 处理和跨平台进程调用保持简单。实际可选方案是 Node.js + TypeScript + npm，或 Python + uv/pipx。

## 决策

SkillArena v0 使用 Node.js、TypeScript 与 npm，并暴露 `skillarena` CLI 命令。

## 理由

- 可通过 npm 简单进行全局安装
- 支持 Windows、macOS 与 Linux 的 CLI 场景
- JSON/YAML 工具成熟
- 易于执行 `codex exec --json`
- 对 eval、trace 和 report schema 有类型检查
- 对开源 CLI 而言是熟悉的项目结构

## 结果

仓库应包含 `package.json`、`tsconfig.json`、`src/`、测试运行器和构建到 `dist/` 的 CLI 入口。在 Codex runner、eval loader、grader 与 reporter 经端到端验证前，不引入重型框架依赖。

Python 仍适合未来的辅助脚本或集成，但 v0 不同时维护 npm 和 Python 两个发布入口。
