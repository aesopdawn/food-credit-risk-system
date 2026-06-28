import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { computeScore, type ScoreResult } from "../lib/scoring";
import { setupTestDatabase } from "./test-db";

type TestDatabase = Awaited<ReturnType<typeof setupTestDatabase>>;

let db: TestDatabase;
let dataModule: typeof import("../lib/data");
let ratingModule: typeof import("../lib/rating");

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const baseEnterprise = {
  legalPerson: "南凯平",
  registeredCapital: 100,
  establishedAt: date("2022-01-01"),
  businessScope: "预包装食品销售、散装食品销售",
  status: "在营",
};

async function createEnterprise(input: {
  id: string;
  name: string;
  uscc: string;
  industry?: string;
  region?: string;
  status?: string;
}) {
  return db.prisma.enterprise.create({
    data: {
      ...baseEnterprise,
      id: input.id,
      name: input.name,
      uscc: input.uscc,
      industry: input.industry ?? "食品销售",
      region: input.region ?? "洪山区",
      status: input.status ?? "在营",
    },
  });
}

function minimalBreakdown(level: string, score: number): string {
  const result: ScoreResult = {
    score,
    level: level as ScoreResult["level"],
    veto: false,
    breakdown: [],
    topRisks: [],
  };
  return JSON.stringify(result);
}

before(async () => {
  db = await setupTestDatabase("food-credit-risk-system");
  dataModule = await import("../lib/data");
  ratingModule = await import("../lib/rating");
});

after(async () => {
  await db.cleanup();
});

beforeEach(async () => {
  await db.prisma.alert.deleteMany();
  await db.prisma.ratingRecord.deleteMany();
  await db.prisma.riskEvent.deleteMany();
  await db.prisma.enterprise.deleteMany();
  await db.prisma.user.deleteMany();
});

describe("data access layer", () => {
  it("builds dashboard statistics from latest ratings, risk events, and open alerts", async () => {
    const a = await createEnterprise({ id: "ent_a", name: "演示A食品有限公司", uscc: "91330100TEST000001" });
    const d = await createEnterprise({
      id: "ent_d",
      name: "演示D餐饮有限公司",
      uscc: "91330100TEST000002",
      industry: "餐饮服务",
      region: "江岸区",
    });

    await db.prisma.ratingRecord.createMany({
      data: [
        { enterpriseId: a.id, score: 72, level: "B", breakdown: minimalBreakdown("B", 72), computedAt: date("2026-01-01") },
        { enterpriseId: a.id, score: 96, level: "A", breakdown: minimalBreakdown("A", 96), computedAt: date("2026-02-01") },
        { enterpriseId: d.id, score: 40, level: "D", breakdown: minimalBreakdown("D", 40), computedAt: date("2026-02-01") },
      ],
    });
    await db.prisma.riskEvent.create({
      data: {
        enterpriseId: d.id,
        type: "PENALTY",
        title: "经营超过保质期的食品",
        severity: 5,
        isVeto: false,
        occurredAt: date("2026-02-02"),
        source: "市场监管局行政处罚系统",
      },
    });
    await db.prisma.alert.create({
      data: {
        enterpriseId: d.id,
        level: "高",
        reason: "信用评级为 D 级（40分），属高风险企业",
        status: "待处置",
      },
    });

    const stats = await dataModule.getDashboardStats();

    assert.equal(stats.total, 2);
    assert.deepEqual(stats.levelCounts, { A: 1, B: 0, C: 0, D: 1 });
    assert.equal(stats.industryLevel["食品销售"].A, 1);
    assert.equal(stats.industryLevel["餐饮服务"].D, 1);
    assert.equal(stats.pendingAlerts, 1);
    assert.equal(stats.totalEvents, 1);
    assert.equal(stats.recentAlerts[0]?.enterprise.name, "演示D餐饮有限公司");
  });

  it("lists enterprises with latest rating, counts, and in-memory level filtering", async () => {
    const a = await createEnterprise({ id: "list_a", name: "湖滨食品销售有限公司", uscc: "91330100TEST100001" });
    const c = await createEnterprise({
      id: "list_c",
      name: "金穗餐饮服务有限公司",
      uscc: "91330100TEST100002",
      industry: "餐饮服务",
    });

    await db.prisma.ratingRecord.createMany({
      data: [
        { enterpriseId: a.id, score: 90, level: "A", breakdown: minimalBreakdown("A", 90) },
        { enterpriseId: c.id, score: 62, level: "C", breakdown: minimalBreakdown("C", 62) },
      ],
    });
    await db.prisma.riskEvent.create({
      data: {
        enterpriseId: c.id,
        type: "COMPLAINT",
        title: "投诉食品中有异物",
        severity: 4,
        isVeto: false,
        occurredAt: date("2026-03-01"),
        source: "12315投诉举报平台",
      },
    });
    await db.prisma.alert.create({
      data: { enterpriseId: c.id, level: "中", reason: "信用评级为 C 级（62分），风险较高需重点关注", status: "已处置" },
    });

    const cLevel = await dataModule.listEnterprises({ level: "C" });
    const keyword = await dataModule.listEnterprises({ keyword: "湖滨" });
    const industry = await dataModule.listEnterprises({ industry: "餐饮服务" });

    assert.equal(cLevel.length, 1);
    assert.equal(cLevel[0].name, "金穗餐饮服务有限公司");
    assert.equal(cLevel[0].events, 1);
    assert.equal(cLevel[0].alerts, 1);
    assert.equal(keyword.length, 1);
    assert.equal(keyword[0].level, "A");
    assert.equal(industry.length, 1);
    assert.equal(industry[0].industry, "餐饮服务");
  });

  it("returns enterprise detail with parsed breakdown and supports fuzzy enterprise lookup", async () => {
    const enterprise = await createEnterprise({
      id: "detail_1",
      name: "鲜达洪山食品经营部",
      uscc: "91330100TEST200001",
    });
    const breakdown = computeScore([
      { type: "PENALTY", title: "经营超过保质期的食品", severity: 5, isVeto: false, occurredAt: date("2026-01-01") },
    ]);
    await db.prisma.ratingRecord.create({
      data: { enterpriseId: enterprise.id, score: breakdown.score, level: breakdown.level, breakdown: JSON.stringify(breakdown) },
    });
    await db.prisma.riskEvent.create({
      data: {
        enterpriseId: enterprise.id,
        type: "PENALTY",
        title: "经营超过保质期的食品",
        severity: 5,
        isVeto: false,
        occurredAt: date("2026-01-01"),
        source: "市场监管局行政处罚系统",
        payload: JSON.stringify({ 备注: "罚款2万元" }),
      },
    });

    const detail = await dataModule.getEnterpriseDetail(enterprise.id);
    const byName = await dataModule.findEnterprise("鲜达洪山");
    const byUscc = await dataModule.findEnterprise("91330100TEST200001");

    assert.equal(detail?.latestRating?.level, "A");
    assert.equal(detail?.events.length, 1);
    assert.equal(detail?.breakdown?.topRisks[0], "【行政处罚】经营超过保质期的食品（扣15分，2026-01-01）");
    assert.equal(byName?.id, enterprise.id);
    assert.equal(byUscc?.id, enterprise.id);
  });
});

describe("rating and alert integration", () => {
  it("returns null when re-rating a missing enterprise", async () => {
    assert.equal(await ratingModule.reRateEnterprise("missing-enterprise"), null);
  });

  it("creates rating records and one medium alert for C-level enterprises without duplicating open alerts", async () => {
    const enterprise = await createEnterprise({ id: "rerate_c", name: "较高风险食品有限公司", uscc: "91330100TEST300001" });
    await db.prisma.riskEvent.createMany({
      data: [
        {
          enterpriseId: enterprise.id,
          type: "PENALTY",
          title: "行政处罚一",
          severity: 5,
          isVeto: false,
          occurredAt: date("2026-01-01"),
          source: "市场监管局行政处罚系统",
        },
        {
          enterpriseId: enterprise.id,
          type: "PENALTY",
          title: "行政处罚二",
          severity: 5,
          isVeto: false,
          occurredAt: date("2026-01-02"),
          source: "市场监管局行政处罚系统",
        },
        {
          enterpriseId: enterprise.id,
          type: "COMPLAINT",
          title: "严重投诉举报",
          severity: 5,
          isVeto: false,
          occurredAt: date("2026-01-03"),
          source: "12315投诉举报平台",
        },
      ],
    });

    const first = await ratingModule.reRateEnterprise(enterprise.id);
    const second = await ratingModule.reRateEnterprise(enterprise.id);
    const ratings = await db.prisma.ratingRecord.findMany({ where: { enterpriseId: enterprise.id } });
    const alerts = await db.prisma.alert.findMany({ where: { enterpriseId: enterprise.id, status: "待处置" } });

    assert.equal(first?.level, "C");
    assert.equal(second?.level, "C");
    assert.equal(ratings.length, 2);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].level, "中");
  });

  it("creates one high alert and caps score when a veto event is present", async () => {
    const enterprise = await createEnterprise({ id: "rerate_d", name: "一票否决食品有限公司", uscc: "91330100TEST300002" });
    await db.prisma.riskEvent.create({
      data: {
        enterpriseId: enterprise.id,
        type: "PENALTY",
        title: "发生群体性食品安全事故",
        severity: 5,
        isVeto: true,
        occurredAt: date("2026-01-01"),
        source: "市场监管局行政处罚系统",
      },
    });

    const first = await ratingModule.reRateEnterprise(enterprise.id);
    const second = await ratingModule.reRateEnterprise(enterprise.id);
    const alerts = await db.prisma.alert.findMany({ where: { enterpriseId: enterprise.id, status: "待处置" } });

    assert.equal(first?.level, "D");
    assert.equal(first?.score, 40);
    assert.equal(second?.level, "D");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].level, "高");
    assert.match(alerts[0].reason, /一票否决/);
  });

  it("keeps child records cascade-deleted with the enterprise", async () => {
    const enterprise = await createEnterprise({ id: "cascade_1", name: "级联删除食品有限公司", uscc: "91330100TEST300003" });
    await db.prisma.riskEvent.create({
      data: {
        enterpriseId: enterprise.id,
        type: "COMPLAINT",
        title: "投诉食品中有异物",
        severity: 4,
        isVeto: false,
        occurredAt: date("2026-01-01"),
        source: "12315投诉举报平台",
      },
    });
    await ratingModule.reRateEnterprise(enterprise.id);
    await db.prisma.enterprise.delete({ where: { id: enterprise.id } });

    assert.equal(await db.prisma.riskEvent.count({ where: { enterpriseId: enterprise.id } }), 0);
    assert.equal(await db.prisma.ratingRecord.count({ where: { enterpriseId: enterprise.id } }), 0);
    assert.equal(await db.prisma.alert.count({ where: { enterpriseId: enterprise.id } }), 0);
  });
});
