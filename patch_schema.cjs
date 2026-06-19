const fs = require('fs');
const path = require('path');

const schemaFile = path.join(__dirname, 'shared', 'schema.ts');
let content = fs.readFileSync(schemaFile, 'utf8');

const newTables = `
// ============================================================================
// COUNTRY IMMUNIZATION CATALOGUE
// ============================================================================

export const commodityTypeEnum = pgEnum("commodity_type", ["diluent", "syringe", "safety_box", "ppe", "cold_chain", "other"]);

// Master Vaccine Products (Stock-managed entities)
export const catalogueVaccines = pgTable("catalogue_vaccines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 100 }).notNull(), // e.g., 'vaccine_product_penta'
  name: varchar("name", { length: 255 }).notNull(),
  antigenName: varchar("antigen_name", { length: 255 }),
  category: varchar("category", { length: 100 }),
  presentation: varchar("presentation", { length: 100 }), // e.g., 'Liquid', 'Lyophilized'
  dosesPerVial: integer("doses_per_vial").notNull().default(1),
  wastageThreshold: decimal("wastage_threshold", { precision: 5, scale: 2 }).default("10.00"),
  stockManaged: boolean("stock_managed").default(true).notNull(),
  forecastable: boolean("forecastable").default(true).notNull(),
  requisitionable: boolean("requisitionable").default(true).notNull(),
  requiresDiluent: boolean("requires_diluent").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  approvalStatus: approvalStatusEnum("approval_status").default("draft").notNull(),
  effectiveStartDate: timestamp("effective_start_date"),
  effectiveEndDate: timestamp("effective_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_catalogue_vaccines_tenant").on(table.tenantId),
  productIdx: index("idx_catalogue_vaccines_product").on(table.productId),
}));

// Administered Schedule Doses (e.g., PENTA-1, PENTA-2)
export const catalogueScheduleDoses = pgTable("catalogue_schedule_doses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vaccineId: integer("vaccine_id").notNull().references(() => catalogueVaccines.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(), // e.g., PENTA-1
  doseNumber: integer("dose_number").notNull().default(1),
  targetAge: varchar("target_age", { length: 100 }),
  stockDeducting: boolean("stock_deducting").default(true).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_catalogue_doses_tenant").on(table.tenantId),
  vaccineIdx: index("idx_catalogue_doses_vaccine").on(table.vaccineId),
}));

// Logistics Commodities (Syringes, Safety Boxes, Diluents)
export const catalogueCommodities = pgTable("catalogue_commodities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  type: commodityTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  packSize: integer("pack_size").default(100).notNull(),
  stockManaged: boolean("stock_managed").default(true).notNull(),
  forecastable: boolean("forecastable").default(true).notNull(),
  consumptionRule: jsonb("consumption_rule").default({}),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_catalogue_commodities_tenant").on(table.tenantId),
}));

export const insertCatalogueVaccineSchema = createInsertSchema(catalogueVaccines);
export const insertCatalogueScheduleDoseSchema = createInsertSchema(catalogueScheduleDoses);
export const insertCatalogueCommoditySchema = createInsertSchema(catalogueCommodities);

export type CatalogueVaccine = typeof catalogueVaccines.$inferSelect;
export type CatalogueScheduleDose = typeof catalogueScheduleDoses.$inferSelect;
export type CatalogueCommodity = typeof catalogueCommodities.$inferSelect;
`;

// Make sure we only add it once
if (!content.includes('catalogueVaccines')) {
  // Find a good spot to insert, perhaps before export const users
  content = content + '\\n' + newTables;
  // Oh wait, approvalStatusEnum might conflict.
}


fs.writeFileSync(schemaFile, content);
console.log("Schema patched.");
