# nano-agent

一个用于学习 Agent 核心机制的 TypeScript 命令行项目。它使用兼容 OpenAI Chat Completions 的模型服务，支持工具调用、子 Agent、任务计划、Skills 按需加载、上下文压缩和终端 Markdown 渲染。

## 快速启动

安装依赖：

```bash
npm install
```

配置 `.env`：

```bash
MODEL_NAME=deepseek-v4-flash
MODEL_API_TOKEN=sk-xxx
MODEL_BASE_URL=https://api.deepseek.com
```

运行开发版：

```bash
npm run dev
```

也可以先构建再运行：

```bash
npm run build
npm start
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 使用 `tsx` 直接运行 TypeScript 源码 |
| `npm run check` | 只做 TypeScript 类型检查 |
| `npm test` | 当前等价于 `npm run check` |
| `npm run build` | 编译到 `dist/` |
| `npm start` | 运行编译后的入口 |

CLI 内部命令：

| 命令 | 说明 |
| --- | --- |
| `/` | 打开快捷命令菜单 |
| `/skills` | 选择并加载一个 Skill |
| `/status` | 查看当前消息、todo 和压缩状态 |
| `/help` | 查看帮助 |
| `/clear` | 清屏 |
| `q` / `exit` | 退出 |

## 架构

```text
src/
├── index.ts              # 程序入口
├── cli.ts                # TUI/交互循环
├── agent.ts              # 父 Agent 主循环
├── model.ts              # OpenAI SDK 兼容模型调用层
├── subagent.ts           # 干净上下文的子 Agent
├── config/
│   └── env.ts            # 环境变量读取
├── context/              # 上下文估算、压缩和大输出持久化
├── planning/             # todo 任务计划系统
├── skills/               # Skill 扫描与加载
├── tools/                # 工具注册、参数校验、执行器和具体工具
├── tui/                  # 终端格式化、spinner、Markdown 渲染
└── types/                # 第三方库类型补充
```

核心流程：

1. `cli.ts` 读取用户输入，维护当前会话 history。
2. `agent.ts` 构造系统提示词，把消息交给 `model.ts`。
3. 模型如果返回普通文本，CLI 直接渲染 Markdown。
4. 模型如果返回 `tool_calls`，`tools/executor.ts` 执行工具并把 tool result 写回 history。
5. loop 继续，直到模型返回最终文本或达到最大轮数。

## 已实现能力

- `bash`：在当前 workspace 执行 PowerShell 命令。
- `read_file` / `write_file` / `edit_file`：安全限制在 workspace 内的文件工具。
- `todo`：维护多步骤任务计划，限制最多一个 `in_progress`。
- `task`：启动子 Agent，用干净上下文处理探索性子任务，只把总结返回父 Agent。
- `load_skill`：从 `skills/**/SKILL.md` 按需加载完整 Skill 内容。
- `compact`：在当前工具结果写回后调度上下文压缩，避免破坏工具调用协议。
- 大工具输出持久化到 `.task_outputs/tool-results/`，history 中只保留预览。

## 设计原则

- 工具注册集中在 `src/tools/registry.ts`。
- 工具实现保持小而明确，参数在边界校验。
- 读工具可以并发，写工具和命令工具串行执行。
- 子 Agent 复用文件系统，但不继承父 Agent 的消息上下文。
- Skills 先只暴露目录摘要，需要时再加载完整内容，节省上下文。
- 上下文压缩先做轻量 tool result 裁剪，超过阈值后生成连续性摘要。
