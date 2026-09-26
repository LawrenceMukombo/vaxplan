/**
 * populate-chunga-facility.ts
 *
 * Populates complete, production-ready demo & operational records for:
 *   Chunga Rural Health Centre (Chinsali) — HMIS Code: 55020003
 *
 * Populates:
 *   1. Facility record details & operating parameters
 *   2. User Accounts & Staff Roster (facilityStaff & users)
 *   3. Community Health Volunteers / CHVs (chvProfiles)
 *   4. Cold Chain Inventory & Equipment (coldChainEquipment)
 *   5. Client Logbook & Vaccination History (clients & clientVaccinations)
 *   6. WHO RED Stock Card Ledger (stockTransactions)
 *   7. Multi-source Populations (populationData for facility level AND community level:
 *      NSO, HMIS, Survey, Community Census, WorldPop)
 *
 * Idempotent: Can be run multiple times safely.
 *
 * Usage:
 *   npx tsx scripts/populate-chunga-facility.ts
 */

import { pool, db } from "../server/db";
import { hash } from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import {
  tenants,
  facilities,
  districts,
  provinces,
  villages,
  users,
  facilityStaff,
  chvProfiles,
  coldChainEquipment,
  clients,
  clientVaccinations,
  stockTransactions,
  populationData,
  vaccineConfigurations,
} from "../shared/schema";

async function main() {
  console.log("\n=============================================================");
  console.log(" Populating Records for Chunga Rural Health Centre (55020003)");
  console.log("=============================================================\n");

  // 1. Resolve ZMB Tenant
  const [zmbTenant] = await db.select().from(tenants).where(eq(tenants.code, "ZMB"));
  if (!zmbTenant) {
    console.error("❌ ZMB tenant not found in database.");
    process.exit(1);
  }
  const tenantId = zmbTenant.id;
  console.log(`✅ ZMB Tenant found: ${zmbTenant.name} (${tenantId})`);

  // 2. Resolve Chunga Facility
  const [facility] = await db
    .select()
    .from(facilities)
    .where(and(eq(facilities.tenantId, tenantId), eq(facilities.hmisCode, "55020003")));

  if (!facility) {
    console.error("❌ Facility 55020003 (Chunga Rural Health Centre) not found.");
    process.exit(1);
  }
  const facilityId = facility.id;
  console.log(`✅ Facility found: ${facility.name} (ID: ${facilityId}, District: ${facility.districtId})`);

  // Resolve District & Province
  let provinceId: number | null = null;
  if (facility.districtId) {
    const [districtObj] = await db.select().from(districts).where(eq(districts.id, facility.districtId));
    if (districtObj && districtObj.provinceId) {
      provinceId = districtObj.provinceId;
    }
  }

  // Update Facility Operational Flags
  await db
    .update(facilities)
    .set({
      hasRefrigerator: true,
      hasPower: true,
      staffCount: 5,
      contactPhone: "+260 977 412 890",
      operatingHours: "24/7 Emergency, 08:00 - 17:00 Routine EPI",
      address: "Chunga Rural Area, Chinsali District, Muchinga Province, Zambia",
      updatedAt: new Date(),
    })
    .where(eq(facilities.id, facilityId));
  console.log("  ↳ Updated facility operational parameters & contact info.");

  // 3. User Accounts for Chunga
  const defaultPassword = await hash("ChungaDemo2026!", 10);

  const demoUsers = [
    {
      id: `usr-chunga-incharge-${facilityId}`,
      tenantId,
      email: "chunga.incharge@moh.gov.zm",
      passwordHash: defaultPassword,
      firstName: "Mary",
      lastName: "Mwape",
      role: "facility_in_charge" as const,
      facilityId,
      districtId: facility.districtId,
      isActive: true,
      status: "active" as const,
    },
    {
      id: `usr-chunga-clerk-${facilityId}`,
      tenantId,
      email: "chunga.clerk@moh.gov.zm",
      passwordHash: defaultPassword,
      firstName: "Joseph",
      lastName: "Malama",
      role: "facility_clerk" as const,
      facilityId,
      districtId: facility.districtId,
      isActive: true,
      status: "active" as const,
    },
  ];

  for (const u of demoUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email));
    if (existing.length === 0) {
      await db.insert(users).values(u);
      console.log(`  ↳ Created user account: ${u.email}`);
    } else {
      await db
        .update(users)
        .set({
          role: u.role,
          facilityId: u.facilityId,
          districtId: u.districtId,
          updatedAt: new Date(),
        })
        .where(eq(users.email, u.email));
      console.log(`  ↳ Updated user account: ${u.email}`);
    }
  }

  // 4. Facility Staff Roster (facilityStaff)
  const staffMembers = [
    {
      fullName: "Sr. Mary Mwape",
      name: "Mary Mwape",
      employeeId: "ZMB-MOH-5502-01",
      nrc: "189204/45/1",
      gender: "female",
      position: "Nursing In-Charge / EPI Coordinator",
      contactPhone: "+260 977 412 890",
      phone: "+260 977 412 890",
      yearsOfProfessionalExperience: 12,
      yearsExperience: 12,
      yearsAtFacility: 4,
      role: "Nurse In-Charge",
      campaignRole: "supervisor",
      educationLevel: "Diploma in Nursing & Public Health",
      trainingStatus: "EPI Master Trained, Cold Chain Certified",
      residenceVillage: "Chunga Central",
      isVolunteer: false,
      userId: `usr-chunga-incharge-${facilityId}`,
    },
    {
      fullName: "Joseph Malama",
      name: "Joseph Malama",
      employeeId: "ZMB-MOH-5502-02",
      nrc: "219803/45/1",
      gender: "male",
      position: "Health Information Clerk / Data Officer",
      contactPhone: "+260 976 102 394",
      phone: "+260 976 102 394",
      yearsOfProfessionalExperience: 6,
      yearsExperience: 6,
      yearsAtFacility: 3,
      role: "Data Clerk",
      campaignRole: "data_recorder",
      educationLevel: "Certificate in Health Records",
      trainingStatus: "DHIS2 & VaxPlan Certified",
      residenceVillage: "Chunga Central",
      isVolunteer: false,
      userId: `usr-chunga-clerk-${facilityId}`,
    },
    {
      fullName: "Patrick Bwalya",
      name: "Patrick Bwalya",
      employeeId: "ZMB-MOH-5502-03",
      nrc: "341902/45/1",
      gender: "male",
      position: "Environmental Health Officer",
      contactPhone: "+260 975 883 291",
      phone: "+260 975 883 291",
      yearsOfProfessionalExperience: 8,
      yearsExperience: 8,
      yearsAtFacility: 5,
      role: "EHO / Vaccinator",
      campaignRole: "vaccinator",
      educationLevel: "BSc Environmental Health",
      trainingStatus: "Cold Chain Repair & Maintenance",
      residenceVillage: "Kanyonga",
      isVolunteer: false,
    },
    {
      fullName: "Memory Mulenga",
      name: "Memory Mulenga",
      employeeId: "ZMB-MOH-5502-04",
      nrc: "402918/45/1",
      gender: "female",
      position: "Community Health Assistant (CHA)",
      contactPhone: "+260 971 392 018",
      phone: "+260 971 392 018",
      yearsOfProfessionalExperience: 5,
      yearsExperience: 5,
      yearsAtFacility: 2,
      role: "CHA Mobilizer",
      campaignRole: "mobilizer",
      educationLevel: "Certificate in Community Health",
      trainingStatus: "Integrated CHW Module Trained",
      residenceVillage: "Chiwale",
      isVolunteer: false,
    },
    {
      fullName: "Charles Musonda",
      name: "Charles Musonda",
      employeeId: "ZMB-MOH-5502-05",
      nrc: "159203/45/1",
      gender: "male",
      position: "Vaccinators Technician",
      contactPhone: "+260 978 203 911",
      phone: "+260 978 203 911",
      yearsOfProfessionalExperience: 4,
      yearsExperience: 4,
      yearsAtFacility: 2,
      role: "Outreach Vaccinator",
      campaignRole: "vaccinator",
      educationLevel: "Certificate in Vaccinology",
      trainingStatus: "Outreach & Mobile EPI Trained",
      residenceVillage: "Malemale",
      isVolunteer: false,
    },
  ];

  for (const s of staffMembers) {
    const existing = await db
      .select()
      .from(facilityStaff)
      .where(and(eq(facilityStaff.tenantId, tenantId), eq(facilityStaff.facilityId, facilityId), eq(facilityStaff.fullName, s.fullName)));

    if (existing.length === 0) {
      await db.insert(facilityStaff).values({
        tenantId,
        facilityId,
        isActive: true,
        active: true,
        ...s,
      });
      console.log(`  ↳ Added staff member: ${s.fullName} (${s.position})`);
    } else {
      await db
        .update(facilityStaff)
        .set({
          ...s,
          updatedAt: new Date(),
        })
        .where(eq(facilityStaff.id, existing[0].id));
      console.log(`  ↳ Updated staff member: ${s.fullName}`);
    }
  }

  // 5. Communities / Villages assigned to Chunga
  const targetCommunityNames = [
    { name: "Chunga Central", code: "CHUNGA-01", isHtr: false, dist: 0.5, time: 10 },
    { name: "Kanyonga", code: "CHUNGA-02", isHtr: false, dist: 9.18, time: 21 },
    { name: "Chiwale", code: "CHUNGA-03", isHtr: true, dist: 10.84, time: 203 },
    { name: "Minso", code: "CHUNGA-04", isHtr: true, dist: 19.82, time: 372 },
    { name: "Malemale", code: "CHUNGA-05", isHtr: false, dist: 7.83, time: 18 },
    { name: "Lenga", code: "CHUNGA-06", isHtr: false, dist: 8.50, time: 25 },
    { name: "Kakakuwuchu", code: "CHUNGA-07", isHtr: false, dist: 12.10, time: 45 },
    { name: "Kisi", code: "CHUNGA-08", isHtr: true, dist: 14.30, time: 90 },
    { name: "Kapinda", code: "CHUNGA-09", isHtr: true, dist: 16.50, time: 120 },
    { name: "Kalunji", code: "CHUNGA-10", isHtr: false, dist: 6.20, time: 15 },
  ];

  for (const c of targetCommunityNames) {
    const existing = await db
      .select()
      .from(villages)
      .where(and(eq(villages.tenantId, tenantId), eq(villages.districtId, facility.districtId), eq(villages.name, c.name)));

    if (existing.length === 0) {
      await db.insert(villages).values({
        tenantId,
        name: c.name,
        code: c.code,
        districtId: facility.districtId,
        assignedFacilityId: facilityId,
        latitude: String(-9.829198 + (Math.random() - 0.5) * 0.1),
        longitude: String(32.512023 + (Math.random() - 0.5) * 0.1),
        distanceToFacility: String(c.dist),
        travelTimeMinutes: c.time,
        isHardToReach: c.isHtr,
        settlementType: "village",
        isActive: true,
      });
      console.log(`  ↳ Inserted community: ${c.name}`);
    } else {
      await db
        .update(villages)
        .set({
          assignedFacilityId: facilityId,
          updatedAt: new Date(),
        })
        .where(eq(villages.id, existing[0].id));
    }
  }

  // Refetch all villages now assigned to Chunga
  const activeVillages = await db
    .select()
    .from(villages)
    .where(and(eq(villages.tenantId, tenantId), eq(villages.assignedFacilityId, facilityId)));

  console.log(`  ↳ Found ${activeVillages.length} active communities assigned to Chunga.`);

  // 6. Seed Community Health Volunteers (chvProfiles)
  const chvList = [
    { fullName: "Bwalya Chanda", nrc: "392019/45/1", gender: "male", age: 34, villageName: "Chunga Central", phone: "+260 971 882 011", siaRole: "supervisor" },
    { fullName: "Catherine Mulenga", nrc: "419028/45/1", gender: "female", age: 29, villageName: "Kanyonga", phone: "+260 977 102 993", siaRole: "vaccinator" },
    { fullName: "David Kanyanta", nrc: "198203/45/1", gender: "male", age: 41, villageName: "Chiwale", phone: "+260 976 339 201", siaRole: "mobilizer" },
    { fullName: "Eunice Kampamba", nrc: "289102/45/1", gender: "female", age: 37, villageName: "Minso", phone: "+260 975 448 102", siaRole: "mobilizer" },
    { fullName: "Francis Chisanga", nrc: "302910/45/1", gender: "male", age: 28, villageName: "Malemale", phone: "+260 978 559 203", siaRole: "volunteer" },
    { fullName: "Grace Mwila", nrc: "591029/45/1", gender: "female", age: 32, villageName: "Lenga", phone: "+260 979 660 304", siaRole: "mobilizer" },
    { fullName: "Harrison Chitembo", nrc: "109283/45/1", gender: "male", age: 45, villageName: "Kakakuwuchu", phone: "+260 971 771 405", siaRole: "mobilizer" },
    { fullName: "Irene Nsakanya", nrc: "298102/45/1", gender: "female", age: 30, villageName: "Kisi", phone: "+260 972 882 506", siaRole: "volunteer" },
    { fullName: "John Bwalya", nrc: "482019/45/1", gender: "male", age: 39, villageName: "Kapinda", phone: "+260 973 993 607", siaRole: "mobilizer" },
    { fullName: "Kondwani Tembo", nrc: "391029/45/1", gender: "male", age: 26, villageName: "Kalunji", phone: "+260 974 004 708", siaRole: "volunteer" },
  ];

  for (const chv of chvList) {
    const targetVil = activeVillages.find((v) => v.name.toLowerCase() === chv.villageName.toLowerCase()) || activeVillages[0];
    const existing = await db
      .select()
      .from(chvProfiles)
      .where(and(eq(chvProfiles.tenantId, tenantId), eq(chvProfiles.facilityId, facilityId), eq(chvProfiles.fullName, chv.fullName)));

    if (existing.length === 0) {
      await db.insert(chvProfiles).values({
        tenantId,
        facilityId,
        assignedVillageId: targetVil?.id ?? null,
        fullName: chv.fullName,
        nrc: chv.nrc,
        gender: chv.gender,
        age: chv.age,
        educationLevel: "Secondary School (Grade 12)",
        trainingReceived: "National Child Health Week & Polio Outbreak Response Trained",
        roleDescription: `Community Health Volunteer for ${chv.villageName}`,
        contactPhone: chv.phone,
        yearsOfService: Math.floor(Math.random() * 8) + 2,
        siaRole: chv.siaRole,
        isActive: true,
        employmentStatus: "Active - In-service",
      });
      console.log(`  ↳ Added CHV Profile: ${chv.fullName} (${chv.villageName})`);
    } else {
      await db
        .update(chvProfiles)
        .set({
          assignedVillageId: targetVil?.id ?? null,
          contactPhone: chv.phone,
          siaRole: chv.siaRole,
          updatedAt: new Date(),
        })
        .where(eq(chvProfiles.id, existing[0].id));
    }
  }

  // 7. Cold Chain Equipment (coldChainEquipment)
  const coldChainItems = [
    {
      equipmentType: "refrigerator",
      brand: "Dometic",
      model: "TCW 40SDD",
      serialNumber: "DOM-2023-CHUNGA-01",
      catalogNumber: "WHO PIS C-01/05",
      capacityLiters: "60.00",
      netStorageCapacityLiters: "45.00",
      temperatureMin: "2.0",
      temperatureMax: "8.0",
      powerSource: "solar_dc",
      energyConsumptionKwhDay: "0.85",
      manufactureYear: 2022,
      installationDate: "2023-04-15",
      purchaseCost: "3500.00",
      purchaseCurrency: "USD",
      warrantyExpiry: "2026-04-15",
      supplier: "UNICEF / Ministry of Health Zambia",
      donorFunded: true,
      fundingSource: "GAVI Cold Chain Optimization Platform (CCOP)",
      condition: "functional",
      lastServiceDate: "2026-05-10",
      nextServiceDue: "2026-11-10",
      lastTemperatureCheck: "2026-09-25",
      maintenanceNotes: "Operating optimally at 4.2°C. Solar direct drive panels cleaned monthly.",
      notes: "Main facility solar refrigerator for routine antigens.",
    },
    {
      equipmentType: "refrigerator",
      brand: "Vestfrost",
      model: "VLS 024 SDD",
      serialNumber: "VEST-2022-CHUNGA-02",
      catalogNumber: "WHO PIS C-01/08",
      capacityLiters: "32.00",
      netStorageCapacityLiters: "22.50",
      temperatureMin: "2.0",
      temperatureMax: "8.0",
      powerSource: "solar_dc",
      energyConsumptionKwhDay: "0.65",
      manufactureYear: 2021,
      installationDate: "2022-09-01",
      purchaseCost: "2800.00",
      purchaseCurrency: "USD",
      warrantyExpiry: "2025-09-01",
      supplier: "UNICEF Zambia",
      donorFunded: true,
      fundingSource: "Global Fund",
      condition: "functional",
      lastServiceDate: "2026-04-12",
      nextServiceDue: "2026-10-12",
      lastTemperatureCheck: "2026-09-25",
      maintenanceNotes: "Secondary backup refrigerator. Tested weekly.",
      notes: "Backup solar unit for outbreak reserves.",
    },
    {
      equipmentType: "cold_box",
      brand: "Dometic",
      model: "CB-44",
      serialNumber: "CB-2021-CHUNGA-01",
      catalogNumber: "WHO PIS E-04/01",
      capacityLiters: "44.00",
      netStorageCapacityLiters: "35.00",
      temperatureMin: "2.0",
      temperatureMax: "8.0",
      powerSource: "none",
      manufactureYear: 2021,
      installationDate: "2021-06-10",
      purchaseCost: "320.00",
      purchaseCurrency: "USD",
      condition: "functional",
      lastServiceDate: "2026-01-15",
      maintenanceNotes: "Heavy duty cold box for outreach transport to Chiwale and Minso.",
      notes: "Holds cold life for up to 132 hours with ice packs.",
    },
    {
      equipmentType: "vaccine_carrier",
      brand: "Blowings",
      model: "VC-1.6L",
      serialNumber: "VC-CHUNGA-01-06",
      catalogNumber: "WHO PIS E-05/02",
      capacityLiters: "1.60",
      netStorageCapacityLiters: "1.60",
      temperatureMin: "2.0",
      temperatureMax: "8.0",
      powerSource: "none",
      manufactureYear: 2023,
      installationDate: "2023-01-10",
      purchaseCost: "45.00",
      purchaseCurrency: "USD",
      condition: "functional",
      notes: "Set of 6 standard vaccine carriers for mobile teams and CHV sessions.",
    },
    {
      equipmentType: "temperature_logger",
      brand: "Berlinger",
      model: "Fridge-tag 2L",
      serialNumber: "FT2L-2023-9921",
      catalogNumber: "WHO PIS E-06/08",
      temperatureMin: "-20.0",
      temperatureMax: "50.0",
      powerSource: "battery",
      manufactureYear: 2023,
      installationDate: "2023-04-15",
      purchaseCost: "65.00",
      purchaseCurrency: "USD",
      condition: "functional",
      lastTemperatureCheck: "2026-09-25",
      maintenanceNotes: "30-day electronic temperature logger attached to TCW 40SDD.",
      notes: "No freeze alarms triggered in past 30 days.",
    },
  ];

  for (const item of coldChainItems) {
    const existing = await db
      .select()
      .from(coldChainEquipment)
      .where(
        and(
          eq(coldChainEquipment.tenantId, tenantId),
          eq(coldChainEquipment.facilityId, facilityId),
          eq(coldChainEquipment.serialNumber, item.serialNumber)
        )
      );

    if (existing.length === 0) {
      await db.insert(coldChainEquipment).values({
        tenantId,
        facilityId,
        isActive: true,
        ...item,
      });
      console.log(`  ↳ Added Cold Chain Equipment: ${item.brand} ${item.model} (${item.serialNumber})`);
    } else {
      await db
        .update(coldChainEquipment)
        .set({
          ...item,
        })
        .where(eq(coldChainEquipment.id, existing[0].id));
    }
  }

  // 8. Client Logbook & Vaccinations (clients & clientVaccinations)
  const existingClients = await db
    .select()
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.facilityId, facilityId)));

  console.log(`\n  ↳ Found ${existingClients.length} existing clients for Chunga.`);

  if (existingClients.length < 15) {
    const now = new Date();
    const demoClientData = [
      { name: "Chanda Mwila", type: "child", gender: "male", ageMonths: 3, parent: "Agnes Mwila", village: "Chunga Central", status: "catchment" },
      { name: "Mutale Bwalya", type: "child", gender: "female", ageMonths: 5, parent: "Grace Bwalya", village: "Kanyonga", status: "catchment" },
      { name: "Kabwe Chisanga", type: "child", gender: "male", ageMonths: 8, parent: "Eunice Chisanga", village: "Chiwale", status: "catchment" },
      { name: "Lombe Mulenga", type: "child", gender: "female", ageMonths: 11, parent: "Catherine Mulenga", village: "Minso", status: "catchment" },
      { name: "Nkonde Kanyanta", type: "child", gender: "male", ageMonths: 14, parent: "Mary Kanyanta", village: "Malemale", status: "catchment" },
      { name: "Chileshe Kampamba", type: "child", gender: "female", ageMonths: 18, parent: "Dorothy Kampamba", village: "Lenga", status: "catchment" },
      { name: "Musonda Nsakanya", type: "child", gender: "male", ageMonths: 2, parent: "Irene Nsakanya", village: "Kakakuwuchu", status: "catchment" },
      { name: "Mwamba Chitembo", type: "child", gender: "female", ageMonths: 4, parent: "Theresa Chitembo", village: "Kisi", status: "catchment" },
      { name: "Mapalo Tembo", type: "child", gender: "male", ageMonths: 6, parent: "Kondwani Tembo", village: "Kapinda", status: "catchment" },
      { name: "Natasha Bwalya", type: "child", gender: "female", ageMonths: 9, parent: "John Bwalya", village: "Kalunji", status: "catchment" },
      { name: "Tetiwe Chanda", type: "pregnant_woman", gender: "female", ageMonths: 288, parent: "Self", village: "Chunga Central", status: "catchment" },
      { name: "Bupe Mwape", type: "pregnant_woman", gender: "female", ageMonths: 312, parent: "Self", village: "Kanyonga", status: "catchment" },
      { name: "Siphiwe Mulenga", type: "pregnant_woman", gender: "female", ageMonths: 264, parent: "Self", village: "Chiwale", status: "catchment" },
      { name: "Thandiwe Chisanga", type: "child", gender: "female", ageMonths: 7, parent: "Beatrice Chisanga", village: "Minso", status: "catchment" },
      { name: "Kondwani Jr Mwila", type: "child", gender: "male", ageMonths: 10, parent: "Peter Mwila", village: "Malemale", status: "catchment" },
    ];

    const vConfigs = await db.select().from(vaccineConfigurations).where(eq(vaccineConfigurations.tenantId, tenantId));
    const findVConfig = (name: string) => vConfigs.find((vc) => vc.name.toLowerCase().includes(name.toLowerCase()))?.id ?? vConfigs[0]?.id ?? 1;

    for (let i = 0; i < demoClientData.length; i++) {
      const cData = demoClientData[i];
      const targetVil = activeVillages.find((v) => v.name.toLowerCase() === cData.village.toLowerCase()) || activeVillages[0];
      const dob = new Date(now.getTime() - cData.ageMonths * 30 * 24 * 60 * 60 * 1000);

      const [newClient] = await db
        .insert(clients)
        .values({
          tenantId,
          facilityId,
          villageId: targetVil.id,
          name: cData.name,
          clientType: cData.type,
          dateOfBirth: dob,
          gender: cData.gender,
          parentName: cData.parent,
          contactPhone: `+260 97${Math.floor(1000000 + Math.random() * 9000000)}`,
          catchmentStatus: cData.status,
          clientId: `ZMB-5502-${2026001 + i}`,
          serialNumber: 1001 + i,
          registrationYear: 2026,
          isActive: true,
        })
        .returning();

      console.log(`  ↳ Created Client: ${cData.name} (${cData.type}, ${cData.village})`);

      if (cData.type === "child") {
        const bcgDate = new Date(dob.getTime() + 2 * 24 * 60 * 60 * 1000);
        await db.insert(clientVaccinations).values({
          tenantId,
          clientId: newClient.id,
          vaccineConfigId: findVConfig("BCG"),
          vaccineName: "BCG",
          administeredDate: bcgDate,
          batchNumber: "BCG-ZMB-2025-098",
          expiryDate: new Date("2027-12-31"),
          vvmStatus: 1,
        });

        await db.insert(clientVaccinations).values({
          tenantId,
          clientId: newClient.id,
          vaccineConfigId: findVConfig("OPV"),
          vaccineName: "OPV-0",
          administeredDate: bcgDate,
          batchNumber: "OPV-ZMB-2025-412",
          expiryDate: new Date("2027-10-31"),
          vvmStatus: 1,
        });

        if (cData.ageMonths >= 2) {
          const p1Date = new Date(dob.getTime() + 45 * 24 * 60 * 60 * 1000);
          await db.insert(clientVaccinations).values({
            tenantId,
            clientId: newClient.id,
            vaccineConfigId: findVConfig("Penta"),
            vaccineName: "Penta-1",
            administeredDate: p1Date,
            batchNumber: "PENTA-ZMB-2025-771",
            expiryDate: new Date("2027-08-31"),
            vvmStatus: 1,
          });

          await db.insert(clientVaccinations).values({
            tenantId,
            clientId: newClient.id,
            vaccineConfigId: findVConfig("PCV"),
            vaccineName: "PCV-1",
            administeredDate: p1Date,
            batchNumber: "PCV-ZMB-2025-339",
            expiryDate: new Date("2027-09-30"),
            vvmStatus: 1,
          });

          await db.insert(clientVaccinations).values({
            tenantId,
            clientId: newClient.id,
            vaccineConfigId: findVConfig("Rotavirus"),
            vaccineName: "Rota-1",
            administeredDate: p1Date,
            batchNumber: "ROTA-ZMB-2025-112",
            expiryDate: new Date("2027-11-30"),
            vvmStatus: 1,
          });
        }

        if (cData.ageMonths >= 4) {
          const p2Date = new Date(dob.getTime() + 75 * 24 * 60 * 60 * 1000);
          await db.insert(clientVaccinations).values({
            tenantId,
            clientId: newClient.id,
            vaccineConfigId: findVConfig("Penta"),
            vaccineName: "Penta-2",
            administeredDate: p2Date,
            batchNumber: "PENTA-ZMB-2025-771",
            expiryDate: new Date("2027-08-31"),
            vvmStatus: 1,
          });
        }

        if (cData.ageMonths >= 10) {
          const mrDate = new Date(dob.getTime() + 270 * 24 * 60 * 60 * 1000);
          await db.insert(clientVaccinations).values({
            tenantId,
            clientId: newClient.id,
            vaccineConfigId: findVConfig("MR"),
            vaccineName: "MR-1",
            administeredDate: mrDate,
            batchNumber: "MR-ZMB-2025-884",
            expiryDate: new Date("2027-06-30"),
            vvmStatus: 1,
          });
        }
      } else if (cData.type === "pregnant_woman") {
        const ttDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        await db.insert(clientVaccinations).values({
          tenantId,
          clientId: newClient.id,
          vaccineConfigId: findVConfig("TT"),
          vaccineName: "TT-1",
          administeredDate: ttDate,
          batchNumber: "TT-ZMB-2025-019",
          expiryDate: new Date("2027-12-31"),
          vvmStatus: 1,
        });
      }
    }
  }

  // 9. WHO RED Stock Card Ledger (stockTransactions)
  const stockItems = [
    { productCode: "VAC-BCG", name: "BCG", doses: 500, batch: "BCG-ZMB-2025-098", expiry: "2027-12-31", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-OPV", name: "OPV", doses: 800, batch: "OPV-ZMB-2025-412", expiry: "2027-10-31", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-PENTA", name: "Penta", doses: 450, batch: "PENTA-ZMB-2025-771", expiry: "2027-08-31", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-PCV", name: "PCV", doses: 450, batch: "PCV-ZMB-2025-339", expiry: "2027-09-30", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-ROTA", name: "Rotavirus", doses: 300, batch: "ROTA-ZMB-2025-112", expiry: "2027-11-30", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-IPV", name: "IPV", doses: 250, batch: "IPV-ZMB-2025-661", expiry: "2027-07-31", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-MR", name: "MR", doses: 350, batch: "MR-ZMB-2025-884", expiry: "2027-06-30", type: "receipt", supplier: "Chinsali District Vaccine Store" },
    { productCode: "VAC-TT", name: "TT", doses: 300, batch: "TT-ZMB-2025-019", expiry: "2027-12-31", type: "receipt", supplier: "Chinsali District Vaccine Store" },
  ];

  for (let idx = 0; idx < stockItems.length; idx++) {
    const s = stockItems[idx];
    const existingTx = await db
      .select()
      .from(stockTransactions)
      .where(
        and(
          eq(stockTransactions.tenantId, tenantId),
          eq(stockTransactions.facilityId, facilityId),
          eq(stockTransactions.productCode, s.productCode),
          eq(stockTransactions.batchNumber, s.batch)
        )
      );

    if (existingTx.length === 0) {
      await db.insert(stockTransactions).values({
        tenantId,
        facilityId,
        productId: 1000 + idx,
        productCode: s.productCode,
        vaccineName: s.name,
        transactionType: s.type,
        quantityDoses: s.doses,
        batchNumber: s.batch,
        expiryDate: new Date(s.expiry),
        vvmStatus: 1,
        supplierOrRecipient: s.supplier,
        transactionDate: new Date("2026-09-01"),
        notes: `Initial stock allocation for Q3/Q4 2026 EPI operations at Chunga Rural Health Centre.`,
        balanceBefore: 0,
        balanceAfter: s.doses,
      });
      console.log(`  ↳ Added Stock Transaction: ${s.name} (${s.doses} doses, Batch: ${s.batch})`);
    }
  }

  // 10. Multi-source Population Records (populationData)
  console.log("\n  ↳ Populating Multi-source Populations (NSO, HMIS, Survey, Community Census, WorldPop)...");

  // Facility-Level Multi-Source Populations
  const facilitySources = [
    { source: "nso" as const, total: 4850, male: 2380, female: 2470, under1: 170, under5: 825, preg: 194, schoolIn: 155, schoolOut: 136, conf: "0.95" },
    { source: "hmis" as const, total: 4720, male: 2310, female: 2410, under1: 165, under5: 802, preg: 189, schoolIn: 151, schoolOut: 132, conf: "0.92" },
    { source: "survey" as const, total: 4910, male: 2410, female: 2500, under1: 172, under5: 835, preg: 196, schoolIn: 157, schoolOut: 137, conf: "0.98" },
    { source: "community_census" as const, total: 4890, male: 2400, female: 2490, under1: 171, under5: 831, preg: 195, schoolIn: 156, schoolOut: 137, conf: "0.97" },
    { source: "worldpop" as const, total: 4830, male: 2370, female: 2460, under1: 169, under5: 821, preg: 193, schoolIn: 154, schoolOut: 135, conf: "0.90" },
  ];

  for (const pop of facilitySources) {
    const existingPop = await db
      .select()
      .from(populationData)
      .where(
        and(
          eq(populationData.tenantId, tenantId),
          eq(populationData.facilityId, facilityId),
          sql`${populationData.villageId} IS NULL`,
          eq(populationData.year, 2026),
          eq(populationData.source, pop.source)
        )
      );

    if (existingPop.length === 0) {
      await db.insert(populationData).values({
        tenantId,
        provinceId: provinceId,
        districtId: facility.districtId,
        facilityId,
        villageId: null,
        source: pop.source,
        year: 2026,
        totalPopulation: pop.total,
        malePopulation: pop.male,
        femalePopulation: pop.female,
        under1Population: pop.under1,
        under5Population: pop.under5,
        pregnantWomen: pop.preg,
        schoolEntry: pop.schoolIn,
        schoolExit: pop.schoolOut,
        growthRate: "0.028",
        confidenceScore: pop.conf,
        approvalStatus: "approved",
      });
      console.log(`    ↳ Facility-level Population (${pop.source.toUpperCase()}): Total ${pop.total}, Under 1: ${pop.under1}`);
    } else {
      await db
        .update(populationData)
        .set({
          totalPopulation: pop.total,
          malePopulation: pop.male,
          femalePopulation: pop.female,
          under1Population: pop.under1,
          under5Population: pop.under5,
          pregnantWomen: pop.preg,
          schoolEntry: pop.schoolIn,
          schoolExit: pop.schoolOut,
          confidenceScore: pop.conf,
          approvalStatus: "approved",
          updatedAt: new Date(),
        })
        .where(eq(populationData.id, existingPop[0].id));
      console.log(`    ↳ Updated Facility-level Population (${pop.source.toUpperCase()}): Total ${pop.total}`);
    }
  }

  // Community-Level Multi-Source Populations
  for (const vil of activeVillages) {
    const basePop = Math.floor(250 + Math.random() * 450);
    const commSources = [
      { source: "nso" as const, factor: 1.0, conf: "0.92" },
      { source: "hmis" as const, factor: 0.96, conf: "0.90" },
      { source: "survey" as const, factor: 1.03, conf: "0.97" },
      { source: "community_census" as const, factor: 1.02, conf: "0.98" },
      { source: "worldpop" as const, factor: 0.99, conf: "0.89" },
    ];

    for (const cs of commSources) {
      const tot = Math.round(basePop * cs.factor);
      const u1 = Math.round(tot * 0.035);
      const u5 = Math.round(tot * 0.17);
      const preg = Math.round(tot * 0.04);
      const schIn = Math.round(tot * 0.032);
      const schOut = Math.round(tot * 0.028);

      const existingCommPop = await db
        .select()
        .from(populationData)
        .where(
          and(
            eq(populationData.tenantId, tenantId),
            eq(populationData.villageId, vil.id),
            eq(populationData.year, 2026),
            eq(populationData.source, cs.source)
          )
        );

      if (existingCommPop.length === 0) {
        await db.insert(populationData).values({
          tenantId,
          provinceId: provinceId,
          districtId: facility.districtId,
          facilityId,
          villageId: vil.id,
          source: cs.source,
          year: 2026,
          totalPopulation: tot,
          malePopulation: Math.round(tot * 0.49),
          femalePopulation: Math.round(tot * 0.51),
          under1Population: u1,
          under5Population: u5,
          pregnantWomen: preg,
          schoolEntry: schIn,
          schoolExit: schOut,
          growthRate: "0.028",
          confidenceScore: cs.conf,
          approvalStatus: "approved",
        });
      } else {
        await db
          .update(populationData)
          .set({
            totalPopulation: tot,
            under1Population: u1,
            under5Population: u5,
            pregnantWomen: preg,
            schoolEntry: schIn,
            schoolExit: schOut,
            confidenceScore: cs.conf,
            approvalStatus: "approved",
            updatedAt: new Date(),
          })
          .where(eq(populationData.id, existingCommPop[0].id));
      }

      if (cs.source === "community_census") {
        await db
          .update(villages)
          .set({
            griddedPopulation: tot,
            populationSourceLabel: "Community Headcount Census (CHV 2026)",
            updatedAt: new Date(),
          })
          .where(eq(villages.id, vil.id));
      }
    }
    console.log(`    ↳ Community Population (${vil.name}): Multi-source records set (Base Pop ~${basePop})`);
  }

  console.log("\n=============================================================");
  console.log(" ✅ All records for Chunga Rural Health Centre (55020003)");
  console.log("    have been successfully populated/upserted!");
  console.log("=============================================================\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error populating Chunga facility records:", err);
  process.exit(1);
});
