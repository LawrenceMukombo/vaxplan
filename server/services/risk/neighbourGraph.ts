/**
 * Neighbour Adjacency Graph Service for VPD Risk Assessment
 * Package: WHO_MEASLES_GLOBAL_RECONCILED_V1
 * 
 * Supports:
 * - Topological candidate generation (shared line boundary)
 * - Review and approval workflow
 * - Cross-border and transport-linked edge additions
 * - Uniqueness and symmetry guarantees
 */

import { db } from "../../db";
import { riskAreaEdges, type RiskAreaEdge, type InsertRiskAreaEdge } from "@shared/riskSchema";
import { eq, and, or } from "drizzle-orm";

export interface CandidateNeighbourEdge {
  districtIdA: number;
  districtIdB: number;
  edgeType?: "land_border" | "transport_corridor" | "island_link" | "cross_border";
  isApproved?: boolean;
  notes?: string;
}

/**
 * Normalizes edge node order so districtIdA is always numerically smaller than districtIdB
 * ensuring symmetry and preventing duplicate bidirectional entries.
 */
export function normalizeEdgeNodes(id1: number, id2: number): { districtIdA: number; districtIdB: number } {
  if (id1 === id2) {
    throw new Error("Self-neighbour relationships are strictly disallowed.");
  }
  return id1 < id2 ? { districtIdA: id1, districtIdB: id2 } : { districtIdA: id2, districtIdB: id1 };
}

/**
 * Validates and stores approved/candidate neighbour relationships
 */
export async function upsertNeighbourEdge(
  tenantId: string,
  edge: CandidateNeighbourEdge
): Promise<void> {
  const { districtIdA, districtIdB } = normalizeEdgeNodes(edge.districtIdA, edge.districtIdB);

  await db
    .insert(riskAreaEdges)
    .values({
      tenantId,
      districtIdA,
      districtIdB,
      edgeType: edge.edgeType || "land_border",
      isApproved: edge.isApproved !== undefined ? edge.isApproved : true,
      notes: edge.notes,
    })
    .onConflictDoUpdate({
      target: [riskAreaEdges.tenantId, riskAreaEdges.districtIdA, riskAreaEdges.districtIdB],
      set: {
        edgeType: edge.edgeType || "land_border",
        isApproved: edge.isApproved !== undefined ? edge.isApproved : true,
        notes: edge.notes,
      },
    });
}

/**
 * Retrieves all approved neighbour area IDs for a given district
 */
export async function getApprovedNeighboursForArea(
  tenantId: string,
  districtId: number
): Promise<number[]> {
  const edges = await db
    .select()
    .from(riskAreaEdges)
    .where(
      and(
        eq(riskAreaEdges.tenantId, tenantId),
        eq(riskAreaEdges.isApproved, true),
        or(eq(riskAreaEdges.districtIdA, districtId), eq(riskAreaEdges.districtIdB, districtId))
      )
    );

  const neighbourIds = new Set<number>();
  for (const e of edges) {
    if (e.districtIdA === districtId) neighbourIds.add(e.districtIdB);
    else neighbourIds.add(e.districtIdA);
  }

  return Array.from(neighbourIds);
}
