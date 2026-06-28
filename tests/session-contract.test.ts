import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertContains, readSource } from "./source-utils";

describe("middleware route protection contract", () => {
  const source = readSource("middleware.ts");

  it("redirects anonymous users to login and redirects logged-in users away from login", () => {
    assert.ok(
      assertContains(source, [
        "verifySessionToken",
        "pathname === \"/login\"",
        "NextResponse.redirect",
        'url.pathname = "/login"',
        'url.pathname = "/"',
      ]),
    );
  });

  it("excludes API routes and static resources from page middleware matching", () => {
    assert.ok(assertContains(source, ["matcher", "api", "_next/static", "_next/image", "favicon.ico"]));
  });
});

describe("server session helper contract", () => {
  const source = readSource("lib/session.ts");

  it("reads signed HttpOnly session cookie and exposes login-required helper", () => {
    assert.ok(
      assertContains(source, [
        "cookies",
        "COOKIE_NAME",
        "verifySessionToken",
        "getSession",
        "requireUser",
        "redirect(\"/login\")",
      ]),
    );
  });
});
