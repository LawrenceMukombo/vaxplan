import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn() }));
vi.mock("../db", () => ({ db: { update: mock.update }, pool: {} }));
import { storage } from "../storage";
describe("microplan persistence approval boundaries", () => {
 beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-22T00:00:00Z"));
  mock.update.mockReturnValue({set:mock.set});mock.set.mockReturnValue({where:mock.where});mock.where.mockReturnValue({returning:mock.returning});mock.returning.mockResolvedValue([{id:1}]);
  vi.spyOn(storage,"getTenant").mockResolvedValue({settings:{minimumPlanDevelopmentDays:21}} as any);
 });
 afterEach(() => {vi.restoreAllMocks();vi.clearAllMocks();vi.useRealTimers();});
 for(const status of ["approved","auto_approved"]) it(`rejects edits and return-to-draft for ${status}`,async()=>{
  vi.spyOn(storage,"getMicroplan").mockResolvedValue({status,createdAt:new Date("2026-01-01")} as any);
  await expect(storage.updateMicroplan("tenant",1,{status:"draft",name:"Changed"} as any)).rejects.toThrow("read-only");
  expect(mock.update).not.toHaveBeenCalled();
 });
 it("rejects early approval before touching persistent fields",async()=>{
  vi.spyOn(storage,"getMicroplan").mockResolvedValue({status:"pending",createdAt:new Date("2026-09-02")} as any);
  await expect(storage.updateMicroplan("tenant",1,{status:"approved"} as any)).rejects.toThrow("21 days");
  expect(mock.update).not.toHaveBeenCalled();
 });
 it("allows approval at the boundary and strips a forged creation date",async()=>{
  vi.spyOn(storage,"getMicroplan").mockResolvedValue({status:"pending",createdAt:new Date("2026-09-01")} as any);
  await storage.updateMicroplan("tenant",1,{status:"approved",createdAt:new Date("2020-01-01")} as any);
  expect(mock.set).toHaveBeenCalledWith({status:"approved",updatedAt:new Date("2026-09-22")});
 });
 it("continues to save normal draft edits",async()=>{
  vi.spyOn(storage,"getMicroplan").mockResolvedValue({status:"draft",createdAt:new Date("2026-09-21")} as any);
  await storage.updateMicroplan("tenant",1,{name:"Draft correction"} as any);
  expect(mock.update).toHaveBeenCalledTimes(1);
 });
 it("allows renaming an approved microplan",async()=>{
  vi.spyOn(storage,"getMicroplan").mockResolvedValue({status:"approved",name:"Old Name",createdAt:new Date("2026-01-01")} as any);
  await storage.updateMicroplan("tenant",1,{name:"Renamed Approved Plan"} as any);
  expect(mock.update).toHaveBeenCalledTimes(1);
  expect(mock.set).toHaveBeenCalledWith({name:"Renamed Approved Plan",updatedAt:new Date("2026-09-22")});
 });
 it("rejects non-rename edits like budget on approved microplans",async()=>{
  vi.spyOn(storage,"getMicroplan").mockResolvedValue({status:"approved",createdAt:new Date("2026-01-01")} as any);
  await expect(storage.updateMicroplan("tenant",1,{budget:"5000"} as any)).rejects.toThrow("read-only");
 });
});
