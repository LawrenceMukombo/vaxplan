import { afterEach, describe, expect, it } from "vitest";
import { isInternalError, safeErrorMessage } from "../errorUtils";

const originalNodeEnv = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

describe("safeErrorMessage", () => {
  it("does not expose database authentication errors in production", () => {
    process.env.NODE_ENV = "production";
    const error = new Error('password authentication failed for user "postgres"');
    expect(safeErrorMessage(error, "Service temporarily unavailable")).toBe("Service temporarily unavailable");
    expect(isInternalError(error)).toBe(true);
  });
  it("does not expose other unexpected errors in production", () => {
    process.env.NODE_ENV = "production";
    expect(safeErrorMessage(new Error("secret implementation detail"), "Request failed")).toBe("Request failed");
  });
  it("preserves details during development", () => {
    process.env.NODE_ENV = "development";
    expect(safeErrorMessage(new Error("debug detail"), "Request failed")).toBe("debug detail");
  });
});