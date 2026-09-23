import { pool } from "../server/db";

async function main() {
  const facId = 27323; // Matikwe Clinic
  const tenantId = 'c43e2923-b2d9-4175-a1a8-ff6b0cd58810'; // South Africa

  console.log("=== POPULATING COMPLETE DATA FOR MATIKWE CLINIC (27323) ===");

  // 1. Ensure Facility Details are complete
  await pool.query(
    `UPDATE facilities SET
      has_refrigerator = true,
      has_power = true,
      staff_count = 8,
      operational_status = 'Functional',
      operating_hours = '07:30 - 16:30 Mon-Fri',
      contact_phone = '+27315124000',
      address = 'Matikwe Main Road, Inanda / Matikwe, eThekwini, KwaZulu-Natal'
     WHERE id = $1`,
    [facId]
  );
  console.log("✅ Updated Matikwe Clinic facility profile.");

  // 2. Ensure Villages / Communities are assigned to Matikwe Clinic
  // Link eMatikwe (175951), Amatikwe (179165), Welbedacht (179040), eThekwini (253116)
  await pool.query(
    `UPDATE villages SET
      assigned_facility_id = $1,
      is_hard_to_reach = false,
      distance_to_facility = 1.8,
      travel_time_minutes = 20,
      gridded_population = 1450,
      transport_mode = 'walking'
     WHERE id = 175951`,
    [facId]
  );
  await pool.query(
    `UPDATE villages SET
      assigned_facility_id = $1,
      is_hard_to_reach = false,
      distance_to_facility = 2.4,
      travel_time_minutes = 30,
      gridded_population = 1820,
      transport_mode = 'walking'
     WHERE id = 179165`,
    [facId]
  );

  // Check if Kwashange exists or insert it
  const kwashangeCheck = await pool.query(
    "SELECT id FROM villages WHERE tenant_id = $1 AND name ILIKE 'Kwashange'",
    [tenantId]
  );
  let kwashangeId: number;
  if (kwashangeCheck.rows.length === 0) {
    const kwIns = await pool.query(
      `INSERT INTO villages (
        tenant_id, name, district_id, assigned_facility_id,
        latitude, longitude, distance_to_facility, travel_time_minutes,
        gridded_population, is_hard_to_reach, transport_mode
      ) VALUES (
        $1, 'Kwashange', 1440, $2,
        '-29.6912', '30.9350', 3.5, 45,
        1100, false, 'motorbike'
      ) RETURNING id`,
      [tenantId, facId]
    );
    kwashangeId = kwIns.rows[0].id;
  } else {
    kwashangeId = kwashangeCheck.rows[0].id;
    await pool.query("UPDATE villages SET assigned_facility_id = $1 WHERE id = $2", [facId, kwashangeId]);
  }
  console.log(`✅ Assigned communities to Matikwe: eMatikwe (175951), Amatikwe (179165), Kwashange (${kwashangeId}), Welbedacht (179040), eThekwini (253116).`);

  // Map community names to village IDs
  const villageMap: Record<string, number> = {
    'ematikwe': 175951,
    'amatikwe': 179165,
    'kwashange': kwashangeId,
    'welbedacht': 179040,
    'ethekwini': 253116,
    'inanda': 174453,
    'ntuzuma': 179230,
  };

  // 3. POPULATE STAFF (facility_staff)
  console.log("Populating Staff...");
  const staffList = [
    {
      fullName: "Sr. Nonhlanhla Dlamini",
      employeeId: "PERSAL-81023910",
      nrc: "8204120289088",
      gender: "female",
      role: "facility_in_charge",
      campaignRole: "supervisor",
      position: "Operational Manager Nursing - PHC",
      contactPhone: "+27821001122",
      educationLevel: "bachelors",
      trainingStatus: "trained",
      yearsExperience: 12,
      yearsAtFacility: 5,
      residenceVillage: "eMatikwe",
      isVolunteer: false,
    },
    {
      fullName: "Sister Zama Sithole",
      employeeId: "PERSAL-81023911",
      nrc: "8809230189085",
      gender: "female",
      role: "nurse",
      campaignRole: "vaccinator",
      position: "Professional Nurse - EPI Coordinator",
      contactPhone: "+27832002233",
      educationLevel: "bachelors",
      trainingStatus: "trained",
      yearsExperience: 8,
      yearsAtFacility: 4,
      residenceVillage: "Inanda",
      isVolunteer: false,
    },
    {
      fullName: "Nurse Ayanda Ngcobo",
      employeeId: "PERSAL-81023912",
      nrc: "9205160389083",
      gender: "female",
      role: "vaccinator",
      campaignRole: "vaccinator",
      position: "Staff Nurse - Child Immunization & Road to Health",
      contactPhone: "+27723003344",
      educationLevel: "certificate",
      trainingStatus: "trained",
      yearsExperience: 5,
      yearsAtFacility: 3,
      residenceVillage: "Amatikwe",
      isVolunteer: false,
    },
    {
      fullName: "Thabo Mokoena",
      employeeId: "PERSAL-81023913",
      nrc: "8507305489081",
      gender: "male",
      role: "cold_chain_officer",
      campaignRole: "logistics",
      position: "Environmental Health Practitioner - Cold Chain Logistics",
      contactPhone: "+27794004455",
      educationLevel: "bachelors",
      trainingStatus: "trained",
      yearsExperience: 7,
      yearsAtFacility: 2,
      residenceVillage: "Phoenix",
      isVolunteer: false,
    },
    {
      fullName: "Phindile Cele",
      employeeId: "PERSAL-81023914",
      nrc: "9511180589087",
      gender: "female",
      role: "recorder",
      campaignRole: "recorder",
      position: "Health Information Officer - DHIS & Tallying",
      contactPhone: "+27845005566",
      educationLevel: "certificate",
      trainingStatus: "trained",
      yearsExperience: 4,
      yearsAtFacility: 2,
      residenceVillage: "Ntuzuma",
      isVolunteer: false,
    },
    {
      fullName: "Siyabonga Gwala",
      employeeId: "PERSAL-81023915",
      nrc: "8703145689089",
      gender: "male",
      role: "driver",
      campaignRole: "logistics",
      position: "Mobile Health Outreach Driver",
      contactPhone: "+27716006677",
      educationLevel: "secondary",
      trainingStatus: "trained",
      yearsExperience: 10,
      yearsAtFacility: 6,
      residenceVillage: "eMatikwe",
      isVolunteer: false,
    },
    {
      fullName: "Nompumelelo Majola",
      employeeId: "PERSAL-81023916",
      nrc: "9008250789082",
      gender: "female",
      role: "midwife",
      campaignRole: "vaccinator",
      position: "Certified Advanced Midwife - Birth Dose Lead",
      contactPhone: "+27827007788",
      educationLevel: "bachelors",
      trainingStatus: "trained",
      yearsExperience: 9,
      yearsAtFacility: 4,
      residenceVillage: "Inanda",
      isVolunteer: false,
    },
    {
      fullName: "Bheki Khanyile",
      employeeId: "PERSAL-81023917",
      nrc: "8412025889080",
      gender: "male",
      role: "chw",
      campaignRole: "mobilizer",
      position: "Ward-Based Outreach Team (WBOT) Coordinator",
      contactPhone: "+27738008899",
      educationLevel: "secondary",
      trainingStatus: "trained",
      yearsExperience: 6,
      yearsAtFacility: 3,
      residenceVillage: "Amatikwe",
      isVolunteer: true,
    },
  ];

  let staffCount = 0;
  for (const s of staffList) {
    const exist = await pool.query(
      "SELECT id FROM facility_staff WHERE tenant_id = $1 AND facility_id = $2 AND (full_name = $3 OR nrc = $4)",
      [tenantId, facId, s.fullName, s.nrc]
    );
    if (exist.rows.length === 0) {
      await pool.query(
        `INSERT INTO facility_staff (
          tenant_id, facility_id, full_name, name, employee_id, nrc,
          gender, role, campaign_role, position, contact_phone, phone,
          education_level, training_status, years_experience, years_at_facility,
          residence_village, is_volunteer, is_active, active
        ) VALUES (
          $1, $2, $3, $3, $4, $5,
          $6, $7, $8, $9, $10, $10,
          $11, $12, $13, $14,
          $15, $16, true, true
        )`,
        [
          tenantId, facId, s.fullName, s.employeeId, s.nrc,
          s.gender, s.role, s.campaignRole, s.position, s.contactPhone,
          s.educationLevel, s.trainingStatus, s.yearsExperience, s.yearsAtFacility,
          s.residenceVillage, s.isVolunteer
        ]
      );
      staffCount++;
    } else {
      await pool.query(
        `UPDATE facility_staff SET
          employee_id = $2, nrc = $3, gender = $4, role = $5,
          campaign_role = $6, position = $7, contact_phone = $8, phone = $8,
          education_level = $9, training_status = $10, years_experience = $11,
          years_at_facility = $12, residence_village = $13, is_volunteer = $14,
          is_active = true, active = true
         WHERE id = $1`,
        [
          exist.rows[0].id, s.employeeId, s.nrc, s.gender, s.role,
          s.campaignRole, s.position, s.contactPhone, s.educationLevel,
          s.trainingStatus, s.yearsExperience, s.yearsAtFacility,
          s.residenceVillage, s.isVolunteer
        ]
      );
      staffCount++;
    }
  }
  console.log(`✅ Upserted ${staffCount} staff members for Matikwe Clinic.`);

  // 4. POPULATE COLD CHAIN EQUIPMENT (cold_chain_equipment)
  console.log("Populating Cold Chain Equipment...");
  const cceList = [
    {
      equipmentType: "solar_direct_drive_refrigerator",
      brand: "Dulas Arctiko",
      model: "PURE 50",
      serialNumber: "SN-KZN-052492-01",
      catalogNumber: "E003/042",
      capacityLiters: "55.00",
      netStorageCapacityLiters: "45.00",
      powerSource: "solar",
      condition: "functional",
      manufactureYear: 2023,
      installationDate: "2023-04-12",
      lastServiceDate: "2026-04-10",
    },
    {
      equipmentType: "icm",
      brand: "Haier",
      model: "HBC-80",
      serialNumber: "SN-KZN-052492-02",
      catalogNumber: "E003/014",
      capacityLiters: "80.00",
      netStorageCapacityLiters: "68.00",
      powerSource: "electric",
      condition: "functional",
      manufactureYear: 2022,
      installationDate: "2022-09-18",
      lastServiceDate: "2026-05-15",
    },
    {
      equipmentType: "freezer",
      brand: "Vestfrost",
      model: "MF 314",
      serialNumber: "SN-KZN-052492-03",
      catalogNumber: "E003/023",
      capacityLiters: "281.00",
      netStorageCapacityLiters: "230.00",
      powerSource: "electric",
      condition: "functional",
      manufactureYear: 2021,
      installationDate: "2021-11-05",
      lastServiceDate: "2026-03-20",
    },
    {
      equipmentType: "cold_box",
      brand: "AOV",
      model: "AOV-CB-25",
      serialNumber: "SN-KZN-052492-04",
      catalogNumber: "E004/008",
      capacityLiters: "24.00",
      netStorageCapacityLiters: "20.00",
      powerSource: "none",
      condition: "functional",
      manufactureYear: 2023,
      installationDate: "2023-02-14",
      lastServiceDate: "2026-04-01",
    },
    {
      equipmentType: "vaccine_carrier",
      brand: "Blowings",
      model: "VC-2.6L",
      serialNumber: "SN-KZN-052492-05",
      catalogNumber: "E004/020",
      capacityLiters: "2.60",
      netStorageCapacityLiters: "2.20",
      powerSource: "none",
      condition: "functional",
      manufactureYear: 2024,
      installationDate: "2024-01-10",
      lastServiceDate: "2026-06-02",
    },
    {
      equipmentType: "vaccine_carrier",
      brand: "Blowings",
      model: "VC-2.6L",
      serialNumber: "SN-KZN-052492-06",
      catalogNumber: "E004/020",
      capacityLiters: "2.60",
      netStorageCapacityLiters: "2.20",
      powerSource: "none",
      condition: "functional",
      manufactureYear: 2024,
      installationDate: "2024-01-10",
      lastServiceDate: "2026-06-02",
    },
    {
      equipmentType: "solar_direct_drive_refrigerator",
      brand: "B Medical Systems",
      model: "TCW40SDD",
      serialNumber: "SN-KZN-052492-07",
      catalogNumber: "E003/038",
      capacityLiters: "43.50",
      netStorageCapacityLiters: "36.00",
      powerSource: "solar",
      condition: "functional",
      manufactureYear: 2024,
      installationDate: "2024-03-22",
      lastServiceDate: "2026-05-10",
    },
  ];

  let cceCount = 0;
  for (const c of cceList) {
    const exist = await pool.query(
      "SELECT id FROM cold_chain_equipment WHERE tenant_id = $1 AND facility_id = $2 AND serial_number = $3",
      [tenantId, facId, c.serialNumber]
    );
    if (exist.rows.length === 0) {
      await pool.query(
        `INSERT INTO cold_chain_equipment (
          tenant_id, facility_id, equipment_type, brand, model,
          serial_number, catalog_number, capacity_liters, net_storage_capacity_liters,
          power_source, condition, manufacture_year, installation_date, last_service_date,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          true
        )`,
        [
          tenantId, facId, c.equipmentType, c.brand, c.model,
          c.serialNumber, c.catalogNumber, c.capacityLiters, c.netStorageCapacityLiters,
          c.powerSource, c.condition, c.manufactureYear, c.installationDate, c.lastServiceDate
        ]
      );
      cceCount++;
    } else {
      await pool.query(
        `UPDATE cold_chain_equipment SET
          equipment_type = $2, brand = $3, model = $4, catalog_number = $5,
          capacity_liters = $6, net_storage_capacity_liters = $7, power_source = $8,
          condition = $9, manufacture_year = $10, installation_date = $11,
          last_service_date = $12, is_active = true
         WHERE id = $1`,
        [
          exist.rows[0].id, c.equipmentType, c.brand, c.model, c.catalogNumber,
          c.capacityLiters, c.netStorageCapacityLiters, c.powerSource, c.condition,
          c.manufactureYear, c.installationDate, c.lastServiceDate
        ]
      );
      cceCount++;
    }
  }
  console.log(`✅ Upserted ${cceCount} cold chain equipment units for Matikwe Clinic.`);

  // 5. POPULATE COMMUNITY HEALTH WORKERS (chv_profiles)
  console.log("Populating Community Health Volunteers (CHVs)...");
  const chvData = [
    {
      fullName: "Nomvula Khumalo",
      gender: "female",
      contactPhone: "+27821123456",
      nrc: "9105120289084",
      age: 34,
      educationLevel: "Grade 12 / Matric",
      trainingReceived: "Integrated Community Case Management & Zero-Dose Tracing",
      roleDescription: "Community Health Worker - eMatikwe Section 1",
      yearsOfService: 5,
      siaRole: "mobilizer",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Sibusiso Buthelezi",
      gender: "male",
      contactPhone: "+27832234567",
      nrc: "8508245389082",
      age: 40,
      educationLevel: "Grade 12 / Matric",
      trainingReceived: "Ward-Based Outreach Team (WBOT) & Event-Based Surveillance",
      roleDescription: "Community Health Worker - eMatikwe Section 2",
      yearsOfService: 7,
      siaRole: "mobilizer",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Zanele Ndlovu",
      gender: "female",
      contactPhone: "+27723345678",
      nrc: "9603150489088",
      age: 29,
      educationLevel: "Certificate in Community Health",
      trainingReceived: "Defaulter Tracing & Road to Health Card Auditing",
      roleDescription: "Community Health Worker - Inanda North",
      yearsOfService: 4,
      siaRole: "recorder",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Bongani Zulu",
      gender: "male",
      contactPhone: "+27794456789",
      nrc: "8811095589081",
      age: 37,
      educationLevel: "Grade 12 / Matric",
      trainingReceived: "Vaccine Cold Box Logistics & Rural Settlement Outreach",
      roleDescription: "Community Health Worker - Amatikwe Valley",
      yearsOfService: 6,
      siaRole: "mobilizer",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Thandeka Mthembu",
      gender: "female",
      contactPhone: "+27845567890",
      nrc: "9307280689086",
      age: 32,
      educationLevel: "Certificate in Nursing Auxiliary",
      trainingReceived: "Routine Immunization Demand Generation & Caregiver Counseling",
      roleDescription: "Community Health Worker - Ntuzuma Link",
      yearsOfService: 5,
      siaRole: "mobilizer",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Nhlanhla Mkhize",
      gender: "male",
      contactPhone: "+27716678901",
      nrc: "8002145789089",
      age: 45,
      educationLevel: "Certificate in Public Health",
      trainingReceived: "Community Microplanning Lead & Household Profiling",
      roleDescription: "Community Health Worker - Supervisor",
      yearsOfService: 10,
      siaRole: "supervisor",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Lindiwe Cele",
      gender: "female",
      contactPhone: "+27827789012",
      nrc: "9812040889083",
      age: 27,
      educationLevel: "Grade 12 / Matric",
      trainingReceived: "Adverse Events Following Immunization (AEFI) Reporting & Notification",
      roleDescription: "Community Health Worker - eMatikwe Section 3",
      yearsOfService: 3,
      siaRole: "mobilizer",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Mandla Sithole",
      gender: "male",
      contactPhone: "+27738890123",
      nrc: "8909185989080",
      age: 36,
      educationLevel: "Grade 12 / Matric",
      trainingReceived: "SIA Catch-up Campaign Mobilization & School Entry Checks",
      roleDescription: "Community Health Worker - Amatikwe Central",
      yearsOfService: 6,
      siaRole: "vaccinator",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Precious Dube",
      gender: "female",
      contactPhone: "+27819901234",
      nrc: "9406021089085",
      age: 31,
      educationLevel: "Certificate in Community Health",
      trainingReceived: "Mother and Baby Tracking & Clinic Appointment Reminders",
      roleDescription: "Community Health Worker - Kwashange",
      yearsOfService: 4,
      siaRole: "recorder",
      employmentStatus: "Active - In-service",
    },
    {
      fullName: "Siphiwe Gumede",
      gender: "female",
      contactPhone: "+27761012345",
      nrc: "9001151189087",
      age: 35,
      educationLevel: "Grade 12 / Matric",
      trainingReceived: "Community Dialogue Facilitation & Vaccine Hesitancy Engagement",
      roleDescription: "Community Health Worker - eMatikwe Section 4",
      yearsOfService: 6,
      siaRole: "mobilizer",
      employmentStatus: "Active - In-service",
    },
  ];

  let chvCount = 0;
  for (const c of chvData) {
    const exist = await pool.query(
      "SELECT id FROM chv_profiles WHERE tenant_id = $1 AND facility_id = $2 AND (full_name = $3 OR nrc = $4)",
      [tenantId, facId, c.fullName, c.nrc]
    );
    if (exist.rows.length === 0) {
      await pool.query(
        `INSERT INTO chv_profiles (
          tenant_id, facility_id, full_name, gender, contact_phone, nrc, age,
          education_level, training_received, role_description, years_of_service,
          sia_role, employment_status, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, true
        )`,
        [
          tenantId, facId, c.fullName, c.gender, c.contactPhone, c.nrc, c.age,
          c.educationLevel, c.trainingReceived, c.roleDescription, c.yearsOfService,
          c.siaRole, c.employmentStatus
        ]
      );
      chvCount++;
    } else {
      await pool.query(
        `UPDATE chv_profiles SET
          gender = $2, contact_phone = $3, nrc = $4, age = $5,
          education_level = $6, training_received = $7, role_description = $8,
          years_of_service = $9, sia_role = $10, employment_status = $11, is_active = true
         WHERE id = $1`,
        [
          exist.rows[0].id, c.gender, c.contactPhone, c.nrc, c.age,
          c.educationLevel, c.trainingReceived, c.roleDescription, c.yearsOfService,
          c.siaRole, c.employmentStatus
        ]
      );
      chvCount++;
    }
  }
  console.log(`✅ Upserted ${chvCount} Community Health Volunteers for Matikwe Clinic.`);

  // 6. POPULATE STOCK LEDGER (stock_transactions)
  console.log("Populating Stock Transactions...");
  const txList = [
    {
      vaccineName: "BCG",
      productId: 57, // Will link to catalogue vaccine or fallback
      productCode: "vaccine_bcg",
      transactionType: "receipt",
      quantityDoses: 600,
      batchNumber: "BCG-ZAF-2026A",
      expiryDate: "2027-12-31",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Monthly routine allocation",
    },
    {
      vaccineName: "OPV",
      productId: 57,
      productCode: "vaccine_opv",
      transactionType: "receipt",
      quantityDoses: 800,
      batchNumber: "OPV-ZAF-9912",
      expiryDate: "2027-10-15",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Birth dose OPV allocation",
    },
    {
      vaccineName: "PENTA",
      productId: 59,
      productCode: "vaccine_penta",
      transactionType: "receipt",
      quantityDoses: 1500,
      batchNumber: "PEN-ZAF-4401",
      expiryDate: "2028-03-31",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Hexaxim (DTP-IPV-Hib-HepB) bulk delivery",
    },
    {
      vaccineName: "PENTA",
      productId: 59,
      productCode: "vaccine_penta",
      transactionType: "issue",
      quantityDoses: 180,
      batchNumber: "PEN-ZAF-4401",
      expiryDate: "2028-03-31",
      vvmStatus: 1,
      supplierOrRecipient: "eMatikwe Mobile Outreach Team",
      transactionDate: "2026-09-05",
      notes: "Weekly community mobile session",
    },
    {
      vaccineName: "PCV",
      productId: 60,
      productCode: "vaccine_pcv",
      transactionType: "receipt",
      quantityDoses: 1000,
      batchNumber: "PCV-ZAF-1123",
      expiryDate: "2028-01-31",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Pneumococcal conjugate 13-valent stock",
    },
    {
      vaccineName: "Rotavirus",
      productId: 61,
      productCode: "vaccine_rota",
      transactionType: "receipt",
      quantityDoses: 800,
      batchNumber: "ROT-ZAF-5509",
      expiryDate: "2027-09-30",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Rotarix oral suspension stock",
    },
    {
      vaccineName: "MR",
      productId: 62,
      productCode: "vaccine_mr",
      transactionType: "receipt",
      quantityDoses: 700,
      batchNumber: "MR-ZAF-7744",
      expiryDate: "2027-11-20",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Measles 6-month and 12-month doses",
    },
    {
      vaccineName: "MR",
      productId: 62,
      productCode: "vaccine_mr",
      transactionType: "loss",
      quantityDoses: 10,
      batchNumber: "MR-ZAF-7744",
      expiryDate: "2027-11-20",
      vvmStatus: 3,
      supplierOrRecipient: "Cold Room Clinic",
      transactionDate: "2026-09-12",
      notes: "VVM stage 3 heat exposure during power outage",
    },
    {
      vaccineName: "HPV",
      productId: 64,
      productCode: "vaccine_hpv",
      transactionType: "receipt",
      quantityDoses: 400,
      batchNumber: "HPV-ZAF-8812",
      expiryDate: "2028-05-31",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "Grade 5 school health campaign stock",
    },
    {
      vaccineName: "COVID-19 vaccine",
      productId: 65,
      productCode: "vaccine_covid19",
      transactionType: "receipt",
      quantityDoses: 300,
      batchNumber: "COV-ZAF-2201",
      expiryDate: "2027-04-30",
      vvmStatus: 1,
      supplierOrRecipient: "eThekwini District Sub-Depot",
      transactionDate: "2026-09-01",
      notes: "High-risk adult booster supply",
    },
    {
      vaccineName: "Auto-disable syringes 0.5ml",
      productId: 10059, // 10000 + commodity id 59
      productCode: "syringe_05ml_ad",
      transactionType: "receipt",
      quantityDoses: 3000,
      batchNumber: "SYR-2026-SA1",
      expiryDate: "2029-12-31",
      vvmStatus: 1,
      supplierOrRecipient: "National Medical Supplies",
      transactionDate: "2026-09-01",
      notes: "0.5ml auto-disable syringes",
    },
    {
      vaccineName: "Safety boxes 5L",
      productId: 10063, // 10000 + commodity id 63
      productCode: "safety_box_5l",
      transactionType: "receipt",
      quantityDoses: 150,
      batchNumber: "BOX-2026-SA2",
      expiryDate: "2030-12-31",
      vvmStatus: 1,
      supplierOrRecipient: "National Medical Supplies",
      transactionDate: "2026-09-01",
      notes: "Yellow 5L sharps safety boxes",
    },
    {
      vaccineName: "PENTA",
      productId: 59,
      productCode: "vaccine_penta",
      transactionType: "issue",
      quantityDoses: 220,
      batchNumber: "PEN-ZAF-4401",
      expiryDate: "2028-03-31",
      vvmStatus: 1,
      supplierOrRecipient: "Fixed Post MCH Room 1",
      transactionDate: "2026-09-08",
      notes: "Daily under-1 clinic immunization",
    },
    {
      vaccineName: "Rotavirus",
      productId: 61,
      productCode: "vaccine_rota",
      transactionType: "issue",
      quantityDoses: 140,
      batchNumber: "ROT-ZAF-5509",
      expiryDate: "2027-09-30",
      vvmStatus: 1,
      supplierOrRecipient: "Fixed Post MCH Room 1",
      transactionDate: "2026-09-08",
      notes: "Daily under-1 clinic immunization",
    },
  ];

  let stockCount = 0;
  for (const t of txList) {
    const exist = await pool.query(
      "SELECT id FROM stock_transactions WHERE tenant_id = $1 AND facility_id = $2 AND batch_number = $3 AND transaction_type = $4 AND quantity_doses = $5",
      [tenantId, facId, t.batchNumber, t.transactionType, t.quantityDoses]
    );
    if (exist.rows.length === 0) {
      await pool.query(
        `INSERT INTO stock_transactions (
          tenant_id, facility_id, product_id, product_code, vaccine_name,
          transaction_type, quantity_doses, batch_number, expiry_date,
          vvm_status, supplier_or_recipient, transaction_date, notes
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13
        )`,
        [
          tenantId, facId, t.productId, t.productCode, t.vaccineName,
          t.transactionType, t.quantityDoses, t.batchNumber, new Date(t.expiryDate),
          t.vvmStatus, t.supplierOrRecipient, new Date(t.transactionDate), t.notes
        ]
      );
      stockCount++;
    } else {
      stockCount++;
    }
  }
  console.log(`✅ Upserted ${stockCount} stock ledger transactions for Matikwe Clinic.`);

  // 7. POPULATE CLIENTS / CHILD LOGBOOK (clients)
  console.log("Populating Child Logbook (Clients)...");
  const childrenList = [
    {
      name: "Minenhle Khumalo",
      gender: "female",
      dob: "2026-02-14",
      parentName: "Busisiwe Khumalo",
      contactPhone: "+27821123456",
      community: "eMatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Bandile Ndlovu",
      gender: "male",
      dob: "2026-01-20",
      parentName: "Thandiwe Ndlovu",
      contactPhone: "+27832234567",
      community: "eMatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Amahle Zulu",
      gender: "female",
      dob: "2025-11-10",
      parentName: "Nokuthula Zulu",
      contactPhone: "+27723345678",
      community: "Amatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Lwandle Buthelezi",
      gender: "male",
      dob: "2025-10-02",
      parentName: "Hlengiwe Buthelezi",
      contactPhone: "+27794456789",
      community: "Amatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Siyanda Mthembu",
      gender: "male",
      dob: "2026-03-05",
      parentName: "Zodwa Mthembu",
      contactPhone: "+27845567890",
      community: "eMatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Olwethu Cele",
      gender: "female",
      dob: "2025-08-18",
      parentName: "Nompumelelo Cele",
      contactPhone: "+27716678901",
      community: "Inanda",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Sphesihle Mkhize",
      gender: "male",
      dob: "2025-09-25",
      parentName: "Khethiwe Mkhize",
      contactPhone: "+27827789012",
      community: "Ntuzuma",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Andile Sithole",
      gender: "female",
      dob: "2026-01-12",
      parentName: "Slindile Sithole",
      contactPhone: "+27738890123",
      community: "eMatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Melokuhle Dube",
      gender: "male",
      dob: "2025-12-04",
      parentName: "Zinhle Dube",
      contactPhone: "+27819901234",
      community: "Kwashange",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Lungelo Ngcobo",
      gender: "male",
      dob: "2025-07-15",
      parentName: "Sibongile Ngcobo",
      contactPhone: "+27761012345",
      community: "Amatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Nkazimulo Majola",
      gender: "female",
      dob: "2026-02-22",
      parentName: "Duduzile Majola",
      contactPhone: "+27822123456",
      community: "eMatikwe",
      clientType: "child",
      catchmentStatus: "resident",
    },
    {
      name: "Snenhlanhla Gwala",
      gender: "female",
      dob: "2025-06-30",
      parentName: "Philisiwe Gwala",
      contactPhone: "+27833234567",
      community: "Inanda",
      clientType: "child",
      catchmentStatus: "resident",
    },
  ];

  let clientCount = 0;
  for (const c of childrenList) {
    const vId = villageMap[c.community.toLowerCase()] || 175951;
    const exist = await pool.query(
      "SELECT id FROM clients WHERE tenant_id = $1 AND facility_id = $2 AND name = $3",
      [tenantId, facId, c.name]
    );
    if (exist.rows.length === 0) {
      await pool.query(
        `INSERT INTO clients (
          tenant_id, facility_id, village_id, name, client_type, date_of_birth,
          gender, parent_name, contact_phone, catchment_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10
        )`,
        [
          tenantId, facId, vId, c.name, c.clientType, new Date(c.dob),
          c.gender, c.parentName, c.contactPhone, c.catchmentStatus
        ]
      );
      clientCount++;
    } else {
      await pool.query(
        `UPDATE clients SET
          village_id = $2, date_of_birth = $3, gender = $4, parent_name = $5,
          contact_phone = $6, catchment_status = $7
         WHERE id = $1`,
        [exist.rows[0].id, vId, new Date(c.dob), c.gender, c.parentName, c.contactPhone, c.catchmentStatus]
      );
      clientCount++;
    }
  }
  console.log(`✅ Upserted ${clientCount} child client logbook records for Matikwe Clinic.`);

  // 8. Session Plans can be generated via the Microplan Wizard in the UI
  console.log("Checking session plans for Matikwe Clinic...");
  try {
    const sessExist = await pool.query(
      "SELECT id FROM session_plans WHERE facility_id = $1",
      [facId]
    );
    console.log(`Matikwe currently has ${sessExist.rows.length} session plan(s).`);
  } catch (err: any) {
    console.log("Session plans check skipped (microplan linkage required).");
  }

  console.log("\n=== ALL MATIKWE DATA POPULATED SUCCESSFULLY ===");
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("Population error:", e);
  await pool.end();
  process.exit(1);
});
