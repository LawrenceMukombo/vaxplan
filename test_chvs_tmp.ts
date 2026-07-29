import { db } from "./server/db";
import { chvProfiles, facilities, villages, districts, provinces, facilityStaff } from "./shared/schema";
import { eq, and, or, asc, desc, ne, inArray, gte, lte, like, ilike, isNull, gt, sql as dsql } from "drizzle-orm";

async function main() {
  try {
    // Let's test the count and joins step by step
    const totalRaw = await db.select({ count: dsql`count(*)` }).from(chvProfiles);
    console.log("Raw chv_profiles count:", totalRaw[0]?.count);

    const joinFac = await db.select({ count: dsql`count(*)` })
      .from(chvProfiles)
      .innerJoin(facilities, eq(chvProfiles.facilityId, facilities.id));
    console.log("After facilities join count:", joinFac[0]?.count);

    const joinDist = await db.select({ count: dsql`count(*)` })
      .from(chvProfiles)
      .innerJoin(facilities, eq(chvProfiles.facilityId, facilities.id))
      .innerJoin(districts, eq(facilities.districtId, districts.id));
    console.log("After districts join count:", joinDist[0]?.count);

    const joinProv = await db.select({ count: dsql`count(*)` })
      .from(chvProfiles)
      .innerJoin(facilities, eq(chvProfiles.facilityId, facilities.id))
      .innerJoin(districts, eq(facilities.districtId, districts.id))
      .innerJoin(provinces, eq(districts.provinceId, provinces.id));
    console.log("After provinces join count:", joinProv[0]?.count);

    // Let's run the exact baseQuery select
    const result = await db.select({
      id: chvProfiles.id,
      fullName: chvProfiles.fullName,
      facilityName: facilities.name,
      districtName: districts.name,
      provinceName: provinces.name,
      villageName: villages.name,
      supervisorName: facilityStaff.fullName
    })
    .from(chvProfiles)
    .innerJoin(facilities, eq(chvProfiles.facilityId, facilities.id))
    .innerJoin(districts, eq(facilities.districtId, districts.id))
    .innerJoin(provinces, eq(districts.provinceId, provinces.id))
    .leftJoin(villages, eq(chvProfiles.assignedVillageId, villages.id))
    .leftJoin(facilityStaff, eq(chvProfiles.supervisorId, facilityStaff.id))
    .limit(5);

    console.log("Base query count limit 5:", result.length);
    if (result.length > 0) {
      console.log("Sample join result:", JSON.stringify(result[0], null, 2));
    }
  } catch (err) {
    console.error("Error executing join query:", err);
  }
  process.exit(0);
}
main();
