import { describe, expect, it } from "vitest";
import { compareMicroplanSnapshots } from "../services/microplanVersionService";

describe("compareMicroplanSnapshots", () => {
  it("reports only changed snapshot paths", () => {
    const changes = compareMicroplanSnapshots(
      { microplan: { status: "pending", budget: "100" }, communities: [{ id: 1 }] },
      { microplan: { status: "returned", budget: "100" }, communities: [{ id: 1 }] },
    );

    expect(changes).toEqual([
      { path: "microplan.status", before: "pending", after: "returned" },
    ]);
  });

  it("treats unchanged arrays as equal", () => {
    expect(compareMicroplanSnapshots({ sessions: [{ id: 1 }] }, { sessions: [{ id: 1 }] })).toEqual([]);
  });
});