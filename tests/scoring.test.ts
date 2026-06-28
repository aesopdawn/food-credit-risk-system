import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeScore, EVENT_TYPES, LEVEL_META, LEVEL_THRESHOLDS, type ScoringEvent } from "../lib/scoring";

const today = () => new Date();

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe("computeScore", () => {
  it("returns a full A rating when an active enterprise has no risk events", () => {
    const result = computeScore([], "在营");

    assert.equal(result.score, 100);
    assert.equal(result.level, "A");
    assert.equal(result.veto, false);
    assert.deepEqual(
      result.breakdown.map((dim) => [dim.name, dim.score, dim.full]),
      [
        ["基础经营", 10, 10],
        ["行政处罚", 35, 35],
        ["抽查检查", 25, 25],
        ["投诉举报", 20, 20],
        ["信用记录", 10, 10],
      ],
    );
  });

  it("deducts points by event type and severity", () => {
    const events: ScoringEvent[] = [
      { type: "PENALTY", title: "经营超过保质期的食品", severity: 5, isVeto: false, occurredAt: today() },
      { type: "INSPECTION", title: "现场检查环境卫生不达标", severity: 4, isVeto: false, occurredAt: today() },
      { type: "COMPLAINT", title: "投诉食品中有异物", severity: 3, isVeto: false, occurredAt: today() },
    ];

    const result = computeScore(events);

    assert.equal(result.score, 69);
    assert.equal(result.level, "C");
    assert.equal(result.breakdown.find((dim) => dim.key === "PENALTY")?.score, 20);
    assert.equal(result.breakdown.find((dim) => dim.key === "INSPECTION")?.score, 15);
    assert.equal(result.breakdown.find((dim) => dim.key === "COMPLAINT")?.score, 14);
    assert.match(result.topRisks[0], /经营超过保质期的食品/);
  });

  it("applies time decay to older risk events", () => {
    const result = computeScore([
      { type: "PENALTY", title: "一年以上行政处罚", severity: 5, isVeto: false, occurredAt: daysAgo(400) },
    ]);

    assert.equal(result.score, 91);
    assert.equal(result.level, "A");
    assert.equal(result.breakdown.find((dim) => dim.key === "PENALTY")?.deductions[0]?.points, 9);
  });

  it("forces D level and caps score when veto is triggered", () => {
    const result = computeScore([
      { type: "PENALTY", title: "发生群体性食品安全事故", severity: 5, isVeto: true, occurredAt: today() },
    ]);

    assert.equal(result.veto, true);
    assert.equal(result.level, "D");
    assert.equal(result.score, 40);
    assert.match(result.topRisks[0], /一票否决/);
  });

  it("keeps license events informational and ignores unknown event types", () => {
    const result = computeScore([
      { type: "LICENSE", title: "取得食品经营许可证", severity: 5, isVeto: false, occurredAt: today() },
      { type: "UNKNOWN", title: "未知事件", severity: 5, isVeto: false, occurredAt: today() },
    ]);

    assert.equal(result.score, 100);
    assert.equal(result.level, "A");
    assert.equal(result.topRisks.length, 0);
  });
});

describe("risk level metadata", () => {
  it("keeps event names, level thresholds, and supervision labels available for UI display", () => {
    assert.equal(EVENT_TYPES.PENALTY, "行政处罚");
    assert.deepEqual(LEVEL_THRESHOLDS, { A: 85, B: 70, C: 60 });
    assert.equal(LEVEL_META.D.supervision, "列为重点监管对象，加大检查力度，从严管理");
  });
});
