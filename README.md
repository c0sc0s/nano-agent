# nano-agent

一个基于 TypeScript 的极简 AI 编程助手，可在命令行中通过自然语言交互，自动完成文件读写、命令执行等开发任务。

---

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置模型

复制或编辑 `.env` 文件：

```
MODEL_NAME=deepseek-v4-flash
MODEL_API_TOKEN=sk-xxx
MODEL_BASE_URL=https://api.deepseek.com
```

支持任何兼容 OpenAI Chat API 的模型服务（如 DeepSeek、OpenAI、通义千问等）。

### 3. 运行

```bash
# 开发模式（tsx 热运行）
npm run dev

# 或先构建再运行
npm run build
npm start
```

启动后进入交互式命令行：

```
nano >> 帮我读一下 src/index.ts
```

输入 `q` 或 `exit` 退出。

---

## 技术架构

```
src/
├── index.ts        # 入口：CLI 交互循环
├── agent.ts        # Agent 主循环：系统提示词 + 多轮工具调用
├── model.ts        # 模型调用层：封装 OpenAI SDK
├── tools.ts        # 工具注册与执行（read_file/write_file/edit_file/bash）
└── config/
    └── env.ts      # 环境变量加载
```

### 核心流程

1. **CLI 入口** (`index.ts`) — 使用 Node.js `readline/promises` 读取用户输入，维护对话历史。
2. **Agent 循环** (`agent.ts`) — 将用户消息与系统提示词一起发给模型。如果模型返回文本则输出结束；如果返回工具调用，则执行对应工具并将结果回传给模型，最多迭代 10 轮。
3. **模型调用** (`model.ts`) — 基于 OpenAI SDK 封装，支持 `tools` 参数和 `tool_choice: "auto"`，自动触发函数调用。
4. **工具系统** (`tools.ts`) — 注册了四种工具：
   - `read_file` — 读取文件（支持行数限制）
   - `write_file` — 写入/覆盖文件（自动创建目录）
   - `edit_file` — 查找替换文本
   - `bash` — 执行 PowerShell 命令（含危险命令拦截）

   安全工具（`read_file`）支持并发调用，非安全工具串行执行。

### 依赖

| 依赖         | 用途                      |
| ------------ | ------------------------- |
| `openai`     | OpenAI API 客户端         |
| `dotenv`     | 加载 `.env` 环境变量      |
| `typescript` | 类型检查与编译            |
| `tsx`        | 开发时直接运行 TypeScript |

---

## 项目命令

| 命令            | 说明                      |
| --------------- | ------------------------- |
| `npm run dev`   | 开发模式运行（tsx）       |
| `npm run build` | TypeScript 编译到 `dist/` |
| `npm start`     | 运行编译后的产物          |
