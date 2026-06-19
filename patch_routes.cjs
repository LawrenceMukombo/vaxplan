const fs = require('fs');
const path = require('path');

const routesFile = path.join(__dirname, 'server', 'routes.ts');
let content = fs.readFileSync(routesFile, 'utf8');

const importsToInject = `
  catalogueVaccines,
  catalogueScheduleDoses,
  catalogueCommodities,
  insertCatalogueVaccineSchema,
  insertCatalogueScheduleDoseSchema,
  insertCatalogueCommoditySchema,
`;

if (!content.includes('catalogueVaccines,')) {
  content = content.replace('  vaccineConfigurations,', '  vaccineConfigurations,' + importsToInject);
}

const newRoutes = `
  // ============================================================================
  // COUNTRY IMMUNIZATION CATALOGUE APIs
  // ============================================================================

  app.get("/api/catalogue/vaccines", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const results = await db.select().from(catalogueVaccines).where(eq(catalogueVaccines.tenantId, req.tenantId));
      res.json(results);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch catalogue vaccines" });
    }
  });

  app.post("/api/catalogue/vaccines", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
    try {
      const data = insertCatalogueVaccineSchema.parse({ ...req.body, tenantId: req.tenantId });
      const [inserted] = await db.insert(catalogueVaccines).values(data).returning();
      res.json(inserted);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to insert catalogue vaccine" });
    }
  });

  app.get("/api/catalogue/schedules", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const results = await db.select().from(catalogueScheduleDoses).where(eq(catalogueScheduleDoses.tenantId, req.tenantId));
      res.json(results);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch catalogue schedules" });
    }
  });

  app.post("/api/catalogue/schedules", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
    try {
      const data = insertCatalogueScheduleDoseSchema.parse({ ...req.body, tenantId: req.tenantId });
      const [inserted] = await db.insert(catalogueScheduleDoses).values(data).returning();
      res.json(inserted);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to insert catalogue schedule" });
    }
  });

  app.get("/api/catalogue/commodities", isAuthenticated, requireTenant, async (req: any, res) => {
    try {
      const results = await db.select().from(catalogueCommodities).where(eq(catalogueCommodities.tenantId, req.tenantId));
      res.json(results);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch catalogue commodities" });
    }
  });

  app.post("/api/catalogue/commodities", isAuthenticated, requireTenant, requirePermission("manage_users"), async (req: any, res) => {
    try {
      const data = insertCatalogueCommoditySchema.parse({ ...req.body, tenantId: req.tenantId });
      const [inserted] = await db.insert(catalogueCommodities).values(data).returning();
      res.json(inserted);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Failed to insert catalogue commodity" });
    }
  });

  return httpServer;
`;

if (!content.includes('"/api/catalogue/vaccines"')) {
  content = content.replace('  return httpServer;', newRoutes);
  fs.writeFileSync(routesFile, content);
  console.log("Routes patched.");
} else {
  console.log("Routes already patched.");
}
