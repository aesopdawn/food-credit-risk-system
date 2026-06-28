import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertContains, readSource } from "./source-utils";

describe("AI report API contract", () => {
  const source = readSource("app/api/report/route.ts");

  it("requires login and returns clear errors for missing enterprise data", () => {
    assert.ok(
      assertContains(source, [
        "getSession",
        "未登录",
        "getEnterpriseDetail",
        "企业不存在",
      ]),
    );
  });

  it("uses enterprise facts and forbids fabrication in the report prompt", () => {
    assert.ok(
      assertContains(source, [
        "企业名称",
        "当前信用等级",
        "综合得分",
        "是否一票否决",
        "主要风险因素",
        "各维度得分",
        "近期风险事件",
        "只能依据给定数据，不要编造数据之外的事实",
      ]),
    );
  });
});

describe("AI chat API contract", () => {
  const source = readSource("app/api/chat/route.ts");

  it("requires login and instructs the assistant to query real system data first", () => {
    assert.ok(
      assertContains(source, [
        "getSession",
        "未登录",
        "必须先调用工具查询系统中的真实数据",
        "不要凭空编造企业或数字",
      ]),
    );
  });

  it("exposes tools for list, profile, rating explanation, and global statistics", () => {
    assert.ok(
      assertContains(source, [
        "listEnterprises: tool",
        "getEnterpriseProfile: tool",
        "explainRating: tool",
        "getStatistics: tool",
        "getDashboardStats",
        "getEnterpriseDetail",
        "findEnterprise",
      ]),
    );
  });

  it("keeps AI as a query and explanation layer around deterministic ratings", () => {
    assert.ok(
      assertContains(source, [
        "信用风险等级说明",
        "给出其等级、综合得分和主要风险因素",
        "调用 explainRating 获取扣分明细后解释",
        "查不到数据时如实说明，不要编造",
      ]),
    );
  });
});
