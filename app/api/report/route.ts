import { deepseek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import { getEnterpriseDetail } from "@/lib/data";

export const maxDuration = 60;

// AI 智能研判：基于企业数据生成一份信用风险研判报告（非流式）
export async function POST(req: Request) {
  const { id } = await req.json();
  const d = await getEnterpriseDetail(id);
  if (!d) return Response.json({ error: "企业不存在" }, { status: 404 });

  const facts = {
    企业名称: d.name,
    行业: d.industry,
    区县: d.region,
    经营状态: d.status,
    当前信用等级: d.latestRating?.level,
    综合得分: d.latestRating?.score,
    是否一票否决: d.breakdown?.veto,
    主要风险因素: d.breakdown?.topRisks ?? [],
    各维度得分: d.breakdown?.breakdown.map((x) => ({ 维度: x.name, 得分: x.score, 满分: x.full })),
    近期风险事件: d.events.slice(0, 12).map((e) => ({
      类型: e.type,
      事由: e.title,
      严重度: e.severity,
      时间: new Date(e.occurredAt).toISOString().slice(0, 10),
    })),
  };

  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    system:
      "你是市场监管信用风险研判专家。基于给定的企业数据，生成一份简明的企业信用风险研判报告，包含三部分：1）总体研判结论；2）主要风险点分析；3）建议的分级监管措施。使用简体中文，分段清晰，约300-400字。只能依据给定数据，不要编造数据之外的事实。",
    prompt: `请基于以下企业数据生成信用风险研判报告：\n${JSON.stringify(facts, null, 2)}`,
  });

  return Response.json({ report: text });
}
