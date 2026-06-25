# 食品企业信用风险分类管理系统

面向**市场监管**场景的食品企业信用风险分类管理系统：归集企业基础信息、行政处罚、抽查检查、投诉举报、信用修复等多维涉企数据，通过**确定性评分引擎**自动完成企业信用风险 **A/B/C/D 四级**动态评级，并提供风险监测、动态预警、分级监管、数据统计、台账管理，以及一个**对话式 AI 智能研判助手**。

> 📖 功能设计详见 [系统功能设计.md](系统功能设计.md)；开发约定见 [CLAUDE.md](CLAUDE.md)。

技术栈：Next.js 16（App Router）· React 19 · Ant Design 6 · Prisma 7 + SQLite · ECharts 6 · Vercel AI SDK 6 + DeepSeek。

---

## 一、环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | **≥ 20**（项目在 Node 24 开发） | [下载](https://nodejs.org) |
| npm | 随 Node 自带 | 本项目用 npm（非 pnpm/yarn） |
| Git | 任意较新版本 | |

> `better-sqlite3` 是原生模块，`npm install` 时会本地编译。一般开箱即用；若编译失败，见文末「常见问题」。

---

## 二、快速开始（5 步跑起来）

### 步骤 1：克隆项目

```bash
git clone https://github.com/aesopdawn/food-credit-risk-system.git
cd food-credit-risk-system
```

### 步骤 2：安装依赖

```bash
npm install
```

> 安装完成后会自动执行 `prisma generate`（生成数据库客户端），无需手动操作。

### 步骤 3：配置环境变量（填写 DeepSeek API Key）⭐

数据库连接（`DATABASE_URL`）已在仓库自带的 `.env` 中配好，**无需改动**。你只需配置一个**含密钥**的 `.env.local`：

**3.1** 复制模板：

```bash
cp .env.example .env.local
```

**3.2** 用编辑器打开 `.env.local`，把 `DEEPSEEK_API_KEY` 改成你自己的真实 Key：

```diff
- DEEPSEEK_API_KEY=sk-your-deepseek-key-here
+ DEEPSEEK_API_KEY=sk-你申请到的真实key
```

**3.3** Key 怎么拿：登录 [DeepSeek 开放平台](https://platform.deepseek.com) → 「API keys」→ 创建，复制以 `sk-` 开头的字符串。

> - `.env.local` 已被 `.gitignore` 排除，**不会被提交**，放心填真实密钥。
> - `AUTH_SECRET`（登录会话签名）**可不填**，不填会回退到内置开发默认值（本地演示足够）。
> - ⚠️ **不填 Key 也能跑**：系统照常登录、看数据、增删改；**只有「AI 对话助手」和「AI 研判报告」两个功能会失效**。

### 步骤 4：初始化数据库

```bash
npx prisma migrate dev   # 按迁移建出本地 dev.db（表结构）
npm run seed             # 灌入 80 家模拟企业 + 涉企数据 + 演示账号
```

> 数据库是**本地 SQLite 文件 `dev.db`**，不进 Git。每个人 seed 出的是各自的随机数据（仅登录账号一致）。

### 步骤 5：启动

```bash
npm run dev
```

打开 **http://localhost:3000**，用下方演示账号登录。

---

## 三、演示登录账号

系统首页需登录。`npm run seed` 会自动创建以下账号：

| 角色 | 用户名 | 密码 | 权限 |
|---|---|---|---|
| 管理员 | `admin` | `admin123` | 全部（含删除企业） |
| 监管执法员 | `inspector` | `123456` | 查看 + 录入/编辑企业与事件、重新评级 |
| 查询岗（只读） | `viewer` | `123456` | 仅查看，不能改数据 |

> 登录页内已内置这三个账号，点一下即可自动填充。

---

## 四、常用命令

```bash
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 生产构建
npm run start        # 运行生产构建
npm run lint         # 代码检查
npm run seed         # 重新生成模拟数据（清空后重建 80 家企业）
npm run db:migrate   # 修改 schema 后创建并应用迁移
npm run db:reset     # 重置数据库并重新 seed
npx prisma studio    # 在浏览器可视化查看 / 编辑数据库
```

---

## 五、常见问题（FAQ）

**Q：AI 对话/研判报告点了没反应或报错？**
A：99% 是没配 `DEEPSEEK_API_KEY`，或 Key 无效/余额不足。检查 `.env.local`，改完**重启** `npm run dev`。其余功能不受影响。

**Q：`npm run dev` 提示端口 3000 被占用？**
A：先关掉占用进程，或用 `npm run dev -- -p 3001` 换端口。

**Q：`npm install` 时 `better-sqlite3` 编译失败？**
A：需要 C++ 构建工具。macOS 装 Xcode Command Line Tools (`xcode-select --install`)；Windows 装「Visual Studio Build Tools」（含 C++ 桌面开发）；Linux 装 `build-essential`、`python3`。装好后重试 `npm install`。

**Q：数据乱了/想重来？**
A：`npm run db:reset` 一键重置数据库并重新 seed。

**Q：为什么队友 clone 后看不到我录入的企业？**
A：数据库是本地 `dev.db`，不进 Git，互不相通。需要团队共享实时数据请切换云端 Postgres（见 [CLAUDE.md](CLAUDE.md) TODO）。

**Q：克隆后第一次跑，最小步骤是什么？**
A：`npm install` → `npx prisma migrate dev` → `npm run seed` → `npm run dev`（不配 Key 也能登录、用除 AI 外的全部功能）。
