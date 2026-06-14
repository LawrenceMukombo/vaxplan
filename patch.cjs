const fs = require('fs');
let content = fs.readFileSync('server/routes/surveillance.ts', 'utf8');

// Find the start and end of the block
const startIdx = content.indexOf('surveillanceRouter.get("/cases", async (req: any, res) => {');
if (startIdx === -1) {
  console.log("Could not find start block");
  process.exit(1);
}

const endStr = '});';
const nextBlockStr = 'surveillanceRouter.get("/cases/kpis", async (req: any, res) => {';
const nextBlockIdx = content.indexOf(nextBlockStr, startIdx);

if (nextBlockIdx === -1) {
  console.log("Could not find next block");
  process.exit(1);
}

const beforeBlock = content.substring(0, startIdx);
const afterBlock = content.substring(nextBlockIdx);

const newBlock = `surveillanceRouter.get("/cases", async (req: any, res) => {
  try {
    const cases = await db
      .select()
      .from(surveillanceCases)
      .where(eq(surveillanceCases.tenantId, req.tenantId));

    const dbUser = req.dbUser!;
    const isFacilityStaff = dbUser.role === "facility_clerk" || dbUser.role === "facility_in_charge" || dbUser.role === "facility_partner";

    if (isFacilityStaff && dbUser.facilityId) {
      cases.forEach(c => {
        if (c.facilityId !== dbUser.facilityId) {
          c.patientName = "De-identified";
          if ((c as any).caretakerName) (c as any).caretakerName = "De-identified";
          if ((c as any).contactPhone) (c as any).contactPhone = "De-identified";
        }
      });
    }

    res.json(cases);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

`;

content = beforeBlock + newBlock + afterBlock;
fs.writeFileSync('server/routes/surveillance.ts', content);
console.log("Success");
