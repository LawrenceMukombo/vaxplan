import { db } from "../db";
import {
  clients,
  clientVaccinations,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface ClientImportRow {
  uniqueId?: string;
  firstName: string;
  lastName: string;
  sex?: string;
  dateOfBirth: string;
  caregiverName?: string;
  caregiverPhone?: string;
  provinceName?: string;
  districtName?: string;
  facilityName?: string;
  communityName?: string;
  clientType?: string;
  status?: string;
}

export interface ClientImportValidationResult {
  totalRows: number;
  validRows: ClientImportRow[];
  invalidRows: { row: number; data: any; errors: string[] }[];
  duplicateRows: { row: number; data: any; matchReason: string; existingClientId: string }[];
}

export async function validateClientImportBatch(
  tenantId: string,
  userFacilityId: number | null,
  userDistrictId: number | null,
  rows: ClientImportRow[],
): Promise<ClientImportValidationResult> {
  const validRows: ClientImportRow[] = [];
  const invalidRows: { row: number; data: any; errors: string[] }[] = [];
  const duplicateRows: { row: number; data: any; matchReason: string; existingClientId: string }[] = [];

  // Fetch existing clients for duplicate matching in tenant
  const existingClients = await db
    .select({
      id: clients.id,
      name: clients.name,
      dateOfBirth: clients.dateOfBirth,
      contactPhone: clients.contactPhone,
      facilityId: clients.facilityId,
    })
    .from(clients)
    .where(eq(clients.tenantId, tenantId));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors: string[] = [];

    if (!row.firstName || !row.firstName.trim()) {
      errors.push("First name is required.");
    }
    if (!row.lastName || !row.lastName.trim()) {
      errors.push("Last name is required.");
    }
    if (!row.dateOfBirth || !row.dateOfBirth.trim()) {
      errors.push("Date of birth is required.");
    } else if (isNaN(Date.parse(row.dateOfBirth))) {
      errors.push("Invalid date of birth format.");
    }

    if (errors.length > 0) {
      invalidRows.push({ row: i + 1, data: row, errors });
      continue;
    }

    const rowFullName = `${row.firstName.trim()} ${row.lastName.trim()}`.toLowerCase();
    const rowDobStr = row.dateOfBirth.substring(0, 10);

    // Check Duplicate Candidates
    const matchingClient = existingClients.find((c) => {
      const dbName = (c.name || "").toLowerCase();
      const nameMatch = dbName === rowFullName || dbName.includes(row.firstName.trim().toLowerCase());
      
      let dobMatch = false;
      if (c.dateOfBirth) {
        const cDobStr = new Date(c.dateOfBirth).toISOString().substring(0, 10);
        dobMatch = cDobStr === rowDobStr;
      }

      const phoneMatch = row.caregiverPhone && c.contactPhone && c.contactPhone.trim() === row.caregiverPhone.trim();

      if (nameMatch && dobMatch) return true;
      if (phoneMatch && nameMatch) return true;
      return false;
    });

    if (matchingClient) {
      duplicateRows.push({
        row: i + 1,
        data: row,
        matchReason: "Facility + Name + Date of Birth Match",
        existingClientId: matchingClient.id,
      });
      continue;
    }

    validRows.push(row);
  }

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
  };
}

export async function checkClientHasLinkedRecords(
  tenantId: string,
  clientId: string,
): Promise<{ hasLinkedRecords: boolean; linkedCount: number; details: string[] }> {
  const details: string[] = [];
  let linkedCount = 0;

  // Check vaccinations
  const vacs = await db
    .select({ count: sql<number>`count(*)` })
    .from(clientVaccinations)
    .where(and(eq(clientVaccinations.tenantId, tenantId), eq(clientVaccinations.clientId, clientId)));

  const vacCount = Number(vacs[0]?.count || 0);
  if (vacCount > 0) {
    linkedCount += vacCount;
    details.push(`${vacCount} immunization records`);
  }

  return {
    hasLinkedRecords: linkedCount > 0,
    linkedCount,
    details,
  };
}
