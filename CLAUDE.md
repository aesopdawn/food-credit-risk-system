# CLAUDE.md — 食品企业信用风险分类管理系统

> 本文件是给 AI（Claude）和开发者的项目说明与约定。每次重要架构变更后请同步更新本文件。

## 1. 项目简介

面向**市场监管**场景的食品企业信用风险分类管理系统。归集企业基础信息、行政处罚、抽查检查、投诉举报、信用修复等多维涉企数据，通过**标准化指标 + 确定性评分引擎**自动完成企业信用风险 **A/B/C/D 四级**动态评级，并提供风险监测、动态预警、分级监管、数据统计、台账管理，以及一个**对话式 AI 智能研判助手**。

Node 全栈、单仓库、前后端不分离。

**开发团队**（共 5 人）：

| 姓名 | 邮箱 |
|---|---|
| aesopdawn | felix.dong.laodan@gmail.com |
| kirsD-e | 3510396243@qq.com |
| HuangSiyun | 601871858@qq.com |
| 科尔比安 | 2023015471@st.cupk.edu.cn |
| nankp236270 | 144219130+nankp236270@users.noreply.github.com |

以上 5 人与 Claude（AI 编程助手）共同完成本项目的开发。

## 2. 技术栈（注意：多为较新大版本，API 与旧版有差异）

| 层 | 选型 | 版本 |
|---|---|---|
| 全栈框架 | Next.js（App Router, TS） | **16.x** |
| UI | Ant Design | **6.x**（中文 locale，不用 Tailwind） |
| 图表 | ECharts（自封装 `components/EChart.tsx`，不用 echarts-for-react） | 6.x |
| ORM | Prisma + driver adapter | **7.x** |
| 数据库 | SQLite（本地文件 `dev.db`） | — |
| 大模型 | DeepSeek（`deepseek-chat`，OpenAI 兼容） | — |
| AI 编排 | Vercel AI SDK（`ai` + `@ai-sdk/react` + `@ai-sdk/deepseek`） | **6.x** |
| 运行时 | React 19 / Node 24 | — |

> ⚠️ Next 16 / antd 6 / AI SDK 6 / Prisma 7 都比常见教程新。写相关代码前，遇到不确定的 API **先查 `node_modules/<pkg>/dist/docs` 或 `.d.ts` 核实**，不要凭旧版记忆写。Next 自带文档在 `node_modules/next/dist/docs/`。

## 3. 常用命令

```bash
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 生产构建
npm run seed         # 重新生成模拟数据（清空后重建 80 家企业）
npm run db:migrate   # 修改 schema 后创建并应用迁移
npm run db:reset     # 重置数据库并重新 seed
npx prisma studio    # 可视化查看数据库
```

## 4. 环境变量

- `.env`（**已提交**，非密钥）：`DATABASE_URL="file:./dev.db"`，Prisma 与运行时都读它。
- `.env.local`（**被 .gitignore 排除，含密钥**）：`DEEPSEEK_API_KEY=...`。
- `.env.example`：模板，新克隆者复制为 `.env.local` 填入自己的 key。
- 克隆后首次运行：`npm install`（postinstall 自动 `prisma generate`）→ `npx prisma migrate dev` → `npm run seed` → 配置 `.env.local` → `npm run dev`。

## 5. 目录结构

```
app/
  layout.tsx              根布局：getSession() 取当前用户 → AntdRegistry + AppShell
  page.tsx                监管总览（服务端取数 → DashboardView）
  login/page.tsx          登录页（未登录由 middleware 跳转至此 → LoginForm）
  enterprises/
    page.tsx              企业名录（→ EnterpriseTable，传 canWrite）
    [id]/page.tsx         企业详情（async params → EnterpriseDetailView，传 canWrite/canDelete）
  alerts/page.tsx         风险预警（→ AlertsView）
  actions/                ⭐ Server Actions（前后端不分离的"写"入口，写后 revalidatePath）
    auth.ts               登录 / 登出
    events.ts             涉企事件增删改 + 重新评级（写操作校验 canWrite）
    enterprises.ts        企业档案增删改（建档/改状态自动重评级；删除校验 isAdmin）
  api/
    chat/route.ts         AI 对话 Agent（流式 + 工具调用；入口校验登录）
    report/route.ts       AI 研判报告（非流式 generateText；入口校验登录）
middleware.ts             路由保护：未登录跳 /login（用 lib/auth 验签，edge 运行）
components/               全部 'use client'：视图 + 图表(EChart) + 表单弹窗 + 对话窗(ChatWidget)
lib/
  db.ts                  Prisma client 单例（driver adapter）
  scoring.ts             ⭐ 评分引擎（纯函数、确定性、可解释）
  rating.ts              重新评级：跑引擎 → 落 RatingRecord → 联动预警（任何增删改后调用）
  data.ts                服务端数据访问层（读；页面与 AI 工具共用）
  auth.ts                ⭐ edge-safe 鉴权纯函数（HMAC 签名 Cookie、角色判定 canWrite/isAdmin）
  session.ts             getSession() / requireUser()（用 next/headers 读当前用户）
  generated/prisma/      Prisma 生成的客户端（gitignore，postinstall 重建）
prisma/
  schema.prisma          数据模型（Enterprise / RiskEvent / RatingRecord / Alert / User）
  seed.ts                模拟数据生成（80 家企业 + 3 个演示账号）
  migrations/            迁移文件
```

## 6. 数据模型（`prisma/schema.prisma`）

- `Enterprise` 企业档案 · `RiskEvent` 涉企事件（统一事件表）· `RatingRecord` 评级记录（保留历史）· `Alert` 预警 · `User` 用户。
- **SQLite 无 JSONB**：`RiskEvent.payload`、`RatingRecord.breakdown` 用 `String` 存 JSON 文本，应用层 `JSON.parse`。

## 7. 评分引擎（`lib/scoring.ts`）—— 核心设计

**评级由确定性指标加权计算，不交给大模型**（监管场景要求可解释、可复现）。
- 5 个维度满分相加 = 100：基础经营(10) / 行政处罚(35) / 抽查检查(25) / 投诉举报(20) / 信用记录(10)。
- 各类事件按 `severity × 系数 × 时间衰减` 扣分；信用修复(REPAIR)加分。
- 阈值：A≥85，B≥70，C≥60，否则 D。
- **一票否决**：`isVeto` 事件（严重食品安全事故）直接定 D 级。
- `breakdown` 记录每维度扣分明细 → 支撑"为什么是这个等级"的解释与 AI 研判。

## 8. AI 设计（两处用法）

1. **对话 Agent**（`app/api/chat/route.ts`）：`streamText` + 工具调用，`stopWhen: stepCountIs(6)`。工具：`listEnterprises` / `getEnterpriseProfile` / `explainRating` / `getStatistics`，全部查真实数据库再作答。前端 `components/ChatWidget.tsx` 用 `useChat` + `DefaultChatTransport`。
2. **研判报告**（`app/api/report/route.ts`）：`generateText` 基于企业数据生成自然语言研判报告。

> 两个 AI 路由入口都先 `getSession()` 校验登录，未登录返回 401（避免未授权调用消耗 DeepSeek 配额）。

## 9. 关键约定 / 易错点（务必遵守）

- **antd 只在 `'use client'` 组件里用**。页面（服务端组件）只负责取数，再传给客户端视图组件——直接在服务端组件用 antd 会因 client-only hooks 报错。
- **Prisma 7 用 driver adapter**：`lib/db.ts` 里 `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })`；客户端从 `lib/generated/prisma/client` 导入。`better-sqlite3` 是原生模块，已在 `next.config.ts` 的 `serverExternalPackages` 中外部化。
- **Next 16 动态路由 `params` 是 Promise**：`const { id } = await params;`。
- **数据页加 `export const dynamic = "force-dynamic"`**：避免构建期预渲染时执行数据库查询。
- **AI SDK v6**：`useChat` 不再托管 input（自己管 + `sendMessage({text})`）；消息是 `parts` 数组；工具用 `tool({ inputSchema })`（不是 `parameters`）；服务端 `convertToModelMessages(messages)` + `result.toUIMessageStreamResponse()`。
- **写操作走 Server Actions**（`app/actions/*`，`"use server"`）：客户端组件直接调用 → 写库 → `revalidatePath` 让总览/名录/预警/详情自动刷新（无需手动 `router.refresh()`）。涉企事件 / 企业的任何增删改后都调用 `reRateEnterprise()` 自动重新评级。antd 6 弹窗用 cssinjs class 控制显隐（**不是** inline `display`），自动化检测可见性时注意。
- **登录鉴权（轻量自建会话，无外部依赖）**：HMAC-SHA256 签名的 HttpOnly Cookie。`lib/auth.ts` 为 edge-safe 纯函数（Web Crypto，供 `middleware.ts` 与服务端共用，**勿在其中引入 `next/headers`/prisma**）；`lib/session.ts` 的 `getSession()` 用 `next/headers` 读当前用户；登录/登出在 `app/actions/auth.ts`；`middleware.ts` 拦截未登录访问。签名密钥读 `AUTH_SECRET`（缺省回退内置开发值）。
- **三级角色**：`admin` 管理员 / `inspector` 监管执法员 / `viewer` 查询岗（只读）。写权限用 `canWrite(role)` 判定（admin/inspector 可写）；写操作**前端隐藏按钮 + Server Action 端二次校验**双重把关。
- 演示登录用户：`admin/admin123`、`inspector/123456`、`viewer/123456`（均在 `User` 表）。

## 10. 后续可做（TODO）

- [x] 涉企事件增删改 + 自动重新评级（`app/actions/events.ts` + `lib/rating.ts`）
- [x] 企业档案增删改（CRUD）+ 建档自动初始评级（`app/actions/enterprises.ts`）
- [x] 登录鉴权 + 三级角色区分（轻量自建 Cookie 会话，见第 9 节；非 Auth.js）
- [x] 评级历史趋势图（企业详情页"评级走势"，ECharts）
- [ ] 台账导出 Excel / PDF
- [ ] 分级监管：按等级自动生成抽查计划
- [ ] 预警的"处置"操作闭环（目前预警仅生成，无人工处置改状态入口）
- [ ] 切换数据库到云端 Postgres（改 `schema.prisma` provider + adapter；可让团队共享数据）
