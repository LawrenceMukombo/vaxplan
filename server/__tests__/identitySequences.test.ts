import { describe, expect, it, vi } from "vitest";
import { REALIGN_IDENTITY_SEQUENCES_SQL, realignIdentitySequences } from "../services/identitySequences";

describe("identity sequence realignment", () => {
  it("targets only public serial or identity sequences", () => {
    expect(REALIGN_IDENTITY_SEQUENCES_SQL).toContain("table_namespace.nspname = 'public'");
    expect(REALIGN_IDENTITY_SEQUENCES_SQL).toContain("pg_get_serial_sequence");
    expect(REALIGN_IDENTITY_SEQUENCES_SQL).toContain("table_class.relkind IN ('r', 'p')");
  });

  it("handles both empty and populated tables", () => {
    expect(REALIGN_IDENTITY_SEQUENCES_SQL).toContain("maximum_id IS NULL");
    expect(REALIGN_IDENTITY_SEQUENCES_SQL).toContain("setval(%L::regclass, 1, false)");
    expect(REALIGN_IDENTITY_SEQUENCES_SQL).toContain("setval(%L::regclass, %s, true)");
  });

  it("executes the realignment SQL through the provided database connection", async () => {
    const db = { execute: vi.fn().mockResolvedValue(undefined) };

    await realignIdentitySequences(db as any);

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute.mock.calls[0][0]).toBeTruthy();
  });
});
