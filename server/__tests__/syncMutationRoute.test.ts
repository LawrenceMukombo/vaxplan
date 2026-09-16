import { describe, expect, it } from "vitest";
import { classifySyncMutationRoute } from "../services/syncMutationRoute";

describe("classifySyncMutationRoute", () => {
  it("dispatches vaccination sub-resources before the client route", () => {
    expect(classifySyncMutationRoute("/api/clients/child-42/vaccinate")).toEqual({
      kind: "client-vaccination",
      clientId: "child-42",
    });
    expect(classifySyncMutationRoute("/api/clients/child-42/vaccinate-batch")).toEqual({
      kind: "client-vaccination-batch",
      clientId: "child-42",
    });
  });

  it("still classifies collection and item client mutations", () => {
    expect(classifySyncMutationRoute("/api/clients")).toEqual({ kind: "client" });
    expect(classifySyncMutationRoute("/api/clients/child-42")).toEqual({ kind: "client" });
  });

  it("ignores unrelated nested client resources", () => {
    expect(classifySyncMutationRoute("/api/clients/child-42/vaccinations")).toEqual({ kind: "other" });
  });
});
