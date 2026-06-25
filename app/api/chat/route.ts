import { deepseek } from "@ai-sdk/deepseek";
import { streamText, convertToModelMessages, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { listEnterprises, getEnterpriseDetail, findEnterprise, getDashboardStats } from "@/lib/data";
import { getSession } from "@/lib/session";

export const maxDuration = 60;

const SYSTEM = `你是"食品企业信用风险分类管理系统"的 AI 监管研判助手，服务于市场监管人员。

信用风险等级说明：
- A 级：低风险，信用良好，可适当降低抽查比例（无事不扰）
- B 级：一般风险，按常规比例抽查
- C 级：较高风险，需提高抽查频次、重点关注
- D 级：高风险，列为重点监管对象，从严管理

工作要求：
1. 必须先调用工具查询系统中的真实数据，再基于数据回答，不要凭空编造企业或数字。
2. 回答使用简体中文，简洁、专业，可用要点罗列。
3. 涉及具体企业时，给出其等级、综合得分和主要风险因素。
4. 用户问"为什么是某等级"时，调用 explainRating 获取扣分明细后解释。
5. 查不到数据时如实说明，不要编造。`;

export async function POST(req: Request) {
  if (!(await getSession())) return new Response("未登录", { status: 401 });
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: deepseek("deepseek-chat"),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
    tools: {
      listEnterprises: tool({
        description:
          "按条件查询企业列表。可按信用等级 level(A/B/C/D)、行业 industry(食品生产/食品销售/餐饮服务/食品添加剂)、区县 region、关键词 keyword 筛选。用于'列出某等级或某行业的企业'等。",
        inputSchema: z.object({
          level: z.enum(["A", "B", "C", "D"]).optional(),
          industry: z.string().optional(),
          region: z.string().optional(),
          keyword: z.string().optional(),
        }),
        execute: async (args) => {
          const list = await listEnterprises(args);
          return {
            count: list.length,
            enterprises: list.slice(0, 30).map((e) => ({
              name: e.name,
              level: e.level,
              score: e.score,
              industry: e.industry,
              region: e.region,
              status: e.status,
            })),
          };
        },
      }),

      getEnterpriseProfile: tool({
        description: "根据企业名称、统一社会信用代码或ID，查询该企业的档案、当前评级、风险事件清单与评分明细。",
        inputSchema: z.object({ query: z.string().describe("企业名称 / 统一社会信用代码 / ID") }),
        execute: async ({ query }) => {
          const e = await findEnterprise(query);
          if (!e) return { found: false, message: "未找到该企业" };
          const d = await getEnterpriseDetail(e.id);
          if (!d) return { found: false };
          return {
            found: true,
            name: d.name,
            uscc: d.uscc,
            industry: d.industry,
            region: d.region,
            legalPerson: d.legalPerson,
            status: d.status,
            level: d.latestRating?.level,
            score: d.latestRating?.score,
            topRisks: d.breakdown?.topRisks ?? [],
            events: d.events.slice(0, 15).map((ev) => ({
              type: ev.type,
              title: ev.title,
              severity: ev.severity,
              isVeto: ev.isVeto,
              occurredAt: new Date(ev.occurredAt).toISOString().slice(0, 10),
            })),
          };
        },
      }),

      explainRating: tool({
        description: "解释某企业为什么被评为当前信用等级，返回各维度得分、扣分明细与主要风险因素。",
        inputSchema: z.object({ query: z.string().describe("企业名称 / 统一社会信用代码 / ID") }),
        execute: async ({ query }) => {
          const e = await findEnterprise(query);
          if (!e) return { found: false, message: "未找到该企业" };
          const d = await getEnterpriseDetail(e.id);
          if (!d || !d.breakdown) return { found: false, message: "暂无评级明细" };
          return {
            found: true,
            name: d.name,
            level: d.latestRating?.level,
            score: d.latestRating?.score,
            veto: d.breakdown.veto,
            dimensions: d.breakdown.breakdown.map((dim) => ({
              维度: dim.name,
              得分: dim.score,
              满分: dim.full,
              扣分项: dim.deductions,
            })),
            topRisks: d.breakdown.topRisks,
          };
        },
      }),

      getStatistics: tool({
        description: "获取全局统计：企业总数、各信用等级(A/B/C/D)数量、各行业等级分布、待处置预警数量、风险事件总数。用于整体态势分析。",
        inputSchema: z.object({}),
        execute: async () => {
          const s = await getDashboardStats();
          return {
            企业总数: s.total,
            各等级数量: s.levelCounts,
            行业等级分布: s.industryLevel,
            待处置预警: s.pendingAlerts,
            风险事件总数: s.totalEvents,
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
