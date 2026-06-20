const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../server/routes/surveillance.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /surveillanceRouter\.patch\("\/cases\/:id", async \(req: any, res\) => \{\s*try \{\s*const \[updated\] = await db\s*\.update\(surveillanceCases\)\s*\.set\(\{ \.\.\.req\.body, updatedAt: new Date\(\) \}\)/;

const replacement = `surveillanceRouter.patch("/cases/:id", async (req: any, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    if (updateData.dateOfOnset) updateData.dateOfOnset = new Date(updateData.dateOfOnset);
    if (updateData.dateReported) updateData.dateReported = new Date(updateData.dateReported);
    if (updateData.investigationDate) updateData.investigationDate = new Date(updateData.investigationDate);

    const [updated] = await db
      .update(surveillanceCases)
      .set(updateData)`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content);
  console.log("Successfully patched surveillance.ts");
} else {
  console.error("Target string not found in surveillance.ts");
}
