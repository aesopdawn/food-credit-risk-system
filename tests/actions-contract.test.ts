import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertContains, readSource } from "./source-utils";

describe("enterprise server action contract", () => {
  const source = readSource("app/actions/enterprises.ts");

  it("validates enterprise input fields before creating or updating records", () => {
    assert.ok(
      assertContains(source, [
        "z.object",
        "name: z.string().trim().min(1",
        "uscc: z.string().trim().min(1",
        "registeredCapital: z.number().min(0",
        'industry: z.enum(["食品生产", "食品销售", "餐饮服务", "食品添加剂"])',
        'status: z.enum(["在营", "注销", "吊销"])',
      ]),
    );
  });

  it("checks write permissions and USCC uniqueness for create and update", () => {
    assert.ok(
      assertContains(source, [
        "getSession",
        "canWrite(user?.role)",
        "无操作权限（当前为只读账号）",
        "usccConflict",
        "该统一社会信用代码已被其他企业使用",
      ]),
    );
  });

  it("creates an initial rating and refreshes affected pages after creating an enterprise", () => {
    assert.ok(
      assertContains(source, [
        "prisma.enterprise.create",
        "await reRateEnterprise(created.id)",
        'revalidatePath("/enterprises")',
        'revalidatePath("/")',
        'revalidatePath("/alerts")',
      ]),
    );
  });

  it("re-rates after enterprise updates and restricts delete to administrators", () => {
    assert.ok(
      assertContains(source, [
        "prisma.enterprise.update",
        "await reRateEnterprise(id)",
        "deleteEnterprise",
        "isAdmin(user?.role)",
        "仅管理员可删除企业",
        "prisma.enterprise.delete",
      ]),
    );
  });
});

describe("risk event server action contract", () => {
  const source = readSource("app/actions/events.ts");

  it("validates event form fields and accepted event types", () => {
    assert.ok(
      assertContains(source, [
        "z.object",
        'type: z.enum(["PENALTY", "INSPECTION", "COMPLAINT", "REPAIR", "LICENSE"])',
        "severity: z.number().int().min(1).max(5)",
        "occurredAt: z.string().min(1",
        "source: z.string().trim().min(1",
        "remark: z.string().trim().max(500).optional()",
      ]),
    );
  });

  it("normalizes payload data and limits veto to negative events", () => {
    assert.ok(
      assertContains(source, [
        'const NEGATIVE_TYPES = ["PENALTY", "INSPECTION", "COMPLAINT"]',
        "function toEventData",
        "isVeto",
        "JSON.stringify({ 备注: d.remark })",
        "new Date(d.occurredAt)",
      ]),
    );
  });

  it("protects write actions with session permissions", () => {
    assert.ok(
      assertContains(source, [
        "denyIfReadOnly",
        "getSession",
        "canWrite(user?.role)",
        "无操作权限（当前为只读账号）",
      ]),
    );
  });

  it("re-rates and refreshes all affected pages after add, update, delete, and manual re-rate", () => {
    assert.ok(
      assertContains(source, [
        "addRiskEvent",
        "updateRiskEvent",
        "deleteRiskEvent",
        "reRateAction",
        "await reRateEnterprise",
        'revalidatePath(`/enterprises/${enterpriseId}`)',
        'revalidatePath("/enterprises")',
        'revalidatePath("/alerts")',
        'revalidatePath("/")',
      ]),
    );
  });
});
