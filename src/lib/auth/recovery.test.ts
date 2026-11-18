import { describe, expect, it } from "vitest";

import { isRecoveryToken } from "./recovery";

const token = (claims: object) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");

describe("isRecoveryToken", () => {
  it("detects a password-reset session", () => {
    expect(isRecoveryToken(token({ amr: [{ method: "recovery", timestamp: 1 }] }))).toBe(true);
  });
  it("ignores other sign-ins and bad input", () => {
    expect(isRecoveryToken(token({ amr: [{ method: "password", timestamp: 1 }] }))).toBe(false);
    expect(isRecoveryToken(token({}))).toBe(false);
    expect(isRecoveryToken("not-a-token")).toBe(false);
    expect(isRecoveryToken(undefined)).toBe(false);
  });
});
