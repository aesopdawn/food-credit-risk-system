import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canWrite,
  createSessionToken,
  isAdmin,
  ROLE_LABELS,
  verifySessionToken,
  type SessionUser,
} from "../lib/auth";

const user: SessionUser = {
  id: "u_test",
  username: "inspector",
  name: "张监管",
  role: "inspector",
};

describe("session token helpers", () => {
  it("creates and verifies a signed session token", async () => {
    const token = await createSessionToken(user);
    const verified = await verifySessionToken(token);

    assert.deepEqual(verified, user);
  });

  it("rejects a tampered session token", async () => {
    const token = await createSessionToken(user);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

    assert.equal(await verifySessionToken(tampered), null);
  });

  it("rejects missing or malformed session tokens", async () => {
    assert.equal(await verifySessionToken(null), null);
    assert.equal(await verifySessionToken("not-a-valid-token"), null);
  });
});

describe("role helpers", () => {
  it("maps roles to permissions used by pages and server actions", () => {
    assert.equal(canWrite("admin"), true);
    assert.equal(canWrite("inspector"), true);
    assert.equal(canWrite("viewer"), false);
    assert.equal(canWrite(undefined), false);

    assert.equal(isAdmin("admin"), true);
    assert.equal(isAdmin("inspector"), false);
    assert.equal(isAdmin("viewer"), false);
  });

  it("keeps role labels stable for UI display", () => {
    assert.deepEqual(ROLE_LABELS, {
      admin: "管理员",
      inspector: "监管执法员",
      viewer: "查询岗",
    });
  });
});
