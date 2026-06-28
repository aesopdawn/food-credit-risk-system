import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertContains, readSource } from "./source-utils";

describe("page data loading contract", () => {
  it("loads dashboard statistics through the server data layer", () => {
    const source = readSource("app/page.tsx");
    assert.ok(assertContains(source, ["getDashboardStats", "DashboardView", 'dynamic = "force-dynamic"']));
  });

  it("loads enterprise list with session-based write permissions", () => {
    const source = readSource("app/enterprises/page.tsx");
    assert.ok(assertContains(source, ["listEnterprises", "getSession", "canWrite", "EnterpriseTable"]));
  });

  it("loads enterprise detail with latest rating, permissions, and serializable view model", () => {
    const source = readSource("app/enterprises/[id]/page.tsx");
    assert.ok(
      assertContains(source, [
        "getEnterpriseDetail",
        "notFound",
        "getSession",
        "canWrite",
        "isAdmin",
        "latestRating",
        "ratingHistory",
        "remarkOf",
        "EnterpriseDetailView",
      ]),
    );
  });

  it("loads alerts with enterprise context for the warning list", () => {
    const source = readSource("app/alerts/page.tsx");
    assert.ok(assertContains(source, ["prisma.alert.findMany", "include", "enterprise", "AlertsView"]));
  });
});

describe("layout and navigation contract", () => {
  const source = readSource("components/AppShell.tsx");

  it("keeps the three main business navigation entries visible", () => {
    assert.ok(
      assertContains(source, [
        "监管总览",
        "企业信用名录",
        "风险预警",
        "DashboardOutlined",
        "ProfileOutlined",
        "AlertOutlined",
      ]),
    );
  });

  it("shows user role information and logout from the shell", () => {
    assert.ok(assertContains(source, ["ROLE_LABELS", "Avatar", "LogoutOutlined", "logout"]));
  });
});

describe("dashboard and list component contract", () => {
  it("renders dashboard statistic cards, charts, and recent alert links", () => {
    const source = readSource("components/DashboardView.tsx");
    assert.ok(
      assertContains(source, [
        "纳管企业总数",
        "D 级高风险企业",
        "待处置预警",
        "归集风险事件",
        "信用等级分布",
        "各行业风险等级分布",
        "最新风险预警",
        'href="/alerts"',
      ]),
    );
  });

  it("renders enterprise filters, table columns, and create action", () => {
    const source = readSource("components/EnterpriseTable.tsx");
    assert.ok(
      assertContains(source, [
        "信用等级",
        "行业",
        "搜索企业名称 / 信用代码",
        "新增企业",
        "综合得分",
        "风险事件",
        "经营状态",
      ]),
    );
  });

  it("renders alert status segmented filter and warning table columns", () => {
    const source = readSource("components/AlertsView.tsx");
    assert.ok(
      assertContains(source, [
        "Segmented",
        "全部",
        "待处置",
        "已处置",
        "预警级别",
        "预警原因",
        "处置状态",
        "预警时间",
      ]),
    );
  });
});

describe("form and detail component contract", () => {
  it("keeps login demo accounts available for presentation", () => {
    const source = readSource("components/LoginForm.tsx");
    assert.ok(
      assertContains(source, [
        "管理员",
        "admin123",
        "监管执法员",
        "inspector",
        "查询岗(只读)",
        "viewer",
        "点击填充",
      ]),
    );
  });

  it("keeps risk event form fields, severity options, and re-rate submit text", () => {
    const source = readSource("components/RiskEventFormModal.tsx");
    assert.ok(
      assertContains(source, [
        "事件类型",
        "事由 / 标题",
        "严重程度",
        "发生时间",
        "数据来源",
        "一票否决",
        "保存并重新评级",
        "5 · 特别严重",
        "仅严重食品安全事故开启",
      ]),
    );
  });

  it("keeps enterprise form field coverage and create/update modes", () => {
    const source = readSource("components/EnterpriseFormModal.tsx");
    assert.ok(
      assertContains(source, [
        "企业名称",
        "统一社会信用代码",
        "法定代表人",
        "注册资本",
        "成立日期",
        "所在区县",
        "经营范围",
        "经营状态",
        "createEnterprise",
        "updateEnterprise",
      ]),
    );
  });

  it("keeps enterprise detail rating, breakdown, event timeline, and AI report controls", () => {
    const source = readSource("components/EnterpriseDetailView.tsx");
    assert.ok(
      assertContains(source, [
        "信用风险评级",
        "分级监管建议",
        "各维度得分明细",
        "评级走势",
        "主要风险因素",
        "涉企风险事件",
        "录入事件",
        "AI 生成信用风险研判报告",
      ]),
    );
  });
});
