# 食品企业信用风险分类管理系统

面向**市场监管**场景的食品企业信用风险分类管理系统：归集企业基础信息、行政处罚、抽查检查、投诉举报、信用修复等多维涉企数据，通过**确定性评分引擎**自动完成企业信用风险 **A/B/C/D 四级**动态评级，并提供风险监测、动态预警与处置闭环、分级监管、数据统计、台账管理，以及一个**对话式 AI 智能研判助手**。

> 📖 功能设计详见 [系统功能设计.md](系统功能设计.md)；开发约定见 [CLAUDE.md](CLAUDE.md)。

技术栈：Next.js 16（App Router）· React 19 · Ant Design 6 · Prisma 7 + SQLite · ECharts 6 · Vercel AI SDK 6 + DeepSeek · react-markdown（Markdown 渲染）· jspdf + html2canvas-pro（PDF 导出）。

---

## 一、功能一览（现在系统能做什么）

- **监管总览**：A/B/C/D 四级分布、各行业等级分布、待处置预警数、风险事件总数等统计图表（ECharts）。
- **企业信用名录**：按等级/行业/区县/关键词筛选；企业档案增删改（建档、编辑、删除）；建档/改经营状态自动评级。
- **企业详情**：档案信息、当前评级与各维度得分明细（含扣分与信用修复加分）、评级走势图、涉企事件时间线。
- **涉企事件管理**：行政处罚 / 抽查检查 / 投诉举报 / 信用修复 / 许可资质五类事件增删改，**任何变更自动重新评级**。
- **确定性评分引擎**：5 维度满分共 100、时间衰减、一票否决；**信用修复可把分加回被扣维度（分数可升可降，且保留原扣分记录）**。
- **风险预警 + 处置闭环** ⭐：评级落到 C/D 自动生成预警 → 执法员**处置销警留痕**（处置方式/措施/处置人/时间）+ 可选写回监管措施事件触发重评级 → 评级回升至 A/B 时系统**自动核销**残留预警。即「采集→评级→预警→处置→措施回写→再评级」完整闭环。
- **AI 智能研判助手** ⭐：① 对话式查询（先查真实数据库再作答，回答按 Markdown 渲染）；② 企业研判报告一键生成（Markdown 渲染、生成有 loading 态、**可直接下载 PDF**）。
- **登录鉴权 + 三级角色**：管理员 / 监管执法员 / 查询岗（只读），写操作前端隐藏按钮 + 服务端二次校验。

---

## 二、环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | **≥ 20**（项目在 Node 24 开发） | [下载](https://nodejs.org) |
| npm | 随 Node 自带 | 本项目用 npm（非 pnpm/yarn） |
| Git | 任意较新版本 | |

> `better-sqlite3` 是原生模块，`npm install` 时会本地编译。一般开箱即用；若编译失败，见文末「常见问题」。

---

## 三、快速开始（首次 clone，5 步跑起来）

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

## 四、拉取更新后（已 clone 过的同学，每次 `git pull` 后看这里）⭐

代码更新里**可能包含新依赖或新的数据库迁移**，直接 `npm run dev` 可能报错。拉完按需执行（**顺序重要**）：

```bash
git pull
npm install                 # ① 可能有新依赖（如 react-markdown / jspdf / html2canvas-pro）
npx prisma migrate dev      # ② 应用新的数据库迁移（表结构有变更时必须）
npm run seed                # ③ 可选：评分规则有调整时执行（见下）
npm run dev
```

为什么这几步重要：

- **② 迁移**：`dev.db` 是你本地的库、不进 Git。新代码若动了表结构（例如「预警处置闭环」给 `Alert` 表加了处置字段），**不跑 `migrate` 会在打开「风险预警 / 处置」时报"列不存在"的错**。
- **③ 重新 seed**：评分引擎调整后（例如「信用修复加分」上线），**数据库里已存的评级不会自动重算**，看起来仍是旧分。想整体看到新效果就 `npm run seed`（会清空重建 80 家），或在单家企业上重新录一条事件触发重评级。
- 嫌麻烦、又不在乎本地数据：直接 `npm run db:reset`（一键重置数据库并重新 seed）。

---

## 五、演示登录账号

系统首页需登录。`npm run seed` 会自动创建以下账号：

| 角色 | 用户名 | 密码 | 权限 |
|---|---|---|---|
| 管理员 | `admin` | `admin123` | 全部（含删除企业） |
| 监管执法员 | `inspector` | `123456` | 查看 + 录入/编辑企业与事件、重新评级、处置预警 |
| 查询岗（只读） | `viewer` | `123456` | 仅查看，不能改数据 |

> 登录页内已内置这三个账号，点一下即可自动填充。

---

## 六、常用命令

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

## 七、常见问题（FAQ）

**Q：AI 对话/研判报告点了没反应或报错？**
A：99% 是没配 `DEEPSEEK_API_KEY`，或 Key 无效/余额不足。检查 `.env.local`，改完**重启** `npm run dev`。其余功能不受影响。

**Q：拉取更新后页面报错 / 打开「风险预警」报"列不存在"（no such column）？**
A：你漏跑了数据库迁移。执行 `npx prisma migrate dev` 应用新迁移（见第四节）；或直接 `npm run db:reset` 重置。

**Q：「信用修复」录进去了，分数怎么没变 / 企业评级看着没更新？**
A：评分引擎升级后，**旧数据的评级不会自动重算**。在该企业上重新录一条事件、或点「重新评级」即可触发；想整体刷新就 `npm run seed`。

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
