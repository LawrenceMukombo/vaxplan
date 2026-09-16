import { describe, expect, it } from "vitest";
import {
  compareMicroplanSnapshots,
  selectVersionCommunities,
} from "../services/microplanVersionService";

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

describe("selectVersionCommunities", () => {
  const submitted = [{ villageId: 1 }, { villageId: 2 }, { villageId: 3 }];
  const live = Array.from({ length: 23 }, (_, index) => ({ id: index + 1 }));

  it("keeps a submitted plan pinned to its three-community snapshot", () => {
    expect(selectVersionCommunities({
      status: "pending",
      staffing: { submissionSnapshot: { communities: submitted } },
    }, live)).toEqual(submitted);
  });

  it("continues using the live catchment for editable drafts", () => {
    expect(selectVersionCommunities({
      status: "draft",
      staffing: { submissionSnapshot: { communities: submitted } },
    }, live)).toHaveLength(23);
  });
});
