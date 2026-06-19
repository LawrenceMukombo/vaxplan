const fs = require('fs');
const path = require('path');

const schemaFile = path.join(__dirname, 'shared', 'schema.ts');
let content = fs.readFileSync(schemaFile, 'utf8');

content = content.replace(
  '  recordedByUserId: varchar("recorded_by_user_id").references(() => users.id, { onDelete: "set null" }),\\n  createdAt: timestamp("created_at").defaultNow(),',
  '  recordedByUserId: varchar("recorded_by_user_id").references(() => users.id, { onDelete: "set null" }),\\n  catalogueVaccineId: integer("catalogue_vaccine_id"),\\n  catalogueCommodityId: integer("catalogue_commodity_id"),\\n  createdAt: timestamp("created_at").defaultNow(),'
);

fs.writeFileSync(schemaFile, content);
console.log("Stock transactions patched.");
