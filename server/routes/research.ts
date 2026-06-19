import { Router, type Response, type NextFunction } from "express";
import { db } from "../db";
import { eq, and, or, ilike, desc, asc, sql } from "drizzle-orm";
import {
  researchDocuments,
  pilotActivities,
  pilotUpdates,
  implementationLessons,
  downloadAssets,
  researchInterestSubmissions,
  researchDownloadEvents,
  insertResearchDocumentSchema,
  insertPilotActivitySchema,
  insertPilotUpdateSchema,
  insertImplementationLessonSchema,
  insertDownloadAssetSchema,
  insertResearchInterestSubmissionSchema,
} from "../../shared/schema";
import { isAuthenticated } from "../auth";
import { requireTenant } from "../auth/tenantResolver";
import { loadDbUser } from "../auth/loadDbUser";

export const researchRouter = Router();

// Middleware to check if user is a Research/Platform Admin
function requireResearchAdmin(req: any, res: Response, next: NextFunction) {
  const user = req.dbUser || req.user;
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const role = user.role;
  const isPlatformAdmin = user.isPlatformAdmin === true;
  const allowedRoles = [
    "national_admin",
    "gis_specialist",
    "national_manager",
    "research_manager",
    "documentation_manager",
    "super_admin",
    "platform_admin",
  ];
  if (isPlatformAdmin || allowedRoles.includes(role)) {
    return next();
  }
  return res.status(403).json({ message: "Access denied: insufficient research hub permissions" });
}

// Helper to check if user is admin
function isUserResearchAdmin(user: any): boolean {
  if (!user) return false;
  const isPlatformAdmin = user.isPlatformAdmin === true;
  const allowedRoles = [
    "national_admin",
    "gis_specialist",
    "national_manager",
    "research_manager",
    "documentation_manager",
    "super_admin",
    "platform_admin",
  ];
  return isPlatformAdmin || allowedRoles.includes(user.role);
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOADS
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIME: Record<string, string> = {
  // ── Documents ────────────────────────────────────────────────────────────
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
  "text/csv": ".csv",
  "text/plain": ".txt",
  // ── Images ────────────────────────────────────────────────────────────
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  // ── Archives ──────────────────────────────────────────────────────────
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "application/x-tar": ".tar",
  "application/gzip": ".gz",
  "application/x-7z-compressed": ".7z",
  // ── Executables / App installers ─────────────────────────────────────
  "application/vnd.android.package-archive": ".apk",
  "application/octet-stream": ".exe",   // also catches generic binary blobs
  "application/x-msdownload": ".exe",
  "application/x-msdos-program": ".exe",
  "application/x-executable": ".bin",
  // ── Video / Data ──────────────────────────────────────────────────────
  "video/mp4": ".mp4",
  "application/json": ".json",
  "application/geo+json": ".geojson",
};

/* Original resolveExt commented out to satisfy AI coding rules and prevent .apk files from saving as .exe when sent as application/octet-stream:
function resolveExt(file: Express.Multer.File): string {
  const fromMime = ALLOWED_MIME[file.mimetype];
  if (fromMime) return fromMime;
  const orig = (file.originalname || "").toLowerCase();
  const knownExts = [".apk", ".exe", ".zip", ".7z", ".tar", ".gz", ".pdf",
    ".docx", ".xlsx", ".pptx", ".csv", ".mp4", ".json", ".geojson"];
  for (const ext of knownExts) {
    if (orig.endsWith(ext)) return ext;
  }
  return ".bin";
}
*/
function resolveExt(file: Express.Multer.File): string {
  const orig = (file.originalname || "").toLowerCase();
  const knownExts = [".apk", ".exe", ".zip", ".7z", ".tar", ".gz", ".pdf",
    ".docx", ".xlsx", ".pptx", ".csv", ".mp4", ".json", ".geojson", ".png", ".jpg", ".jpeg", ".gif", ".webp"];
  for (const ext of knownExts) {
    if (orig.endsWith(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  }
  const fromMime = ALLOWED_MIME[file.mimetype];
  if (fromMime) return fromMime;
  return ".bin";
}

researchRouter.post(
  "/upload",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const _multer = (await import("multer")).default;
      const _path = await import("path");
      const _fs = await import("fs");
      const _crypto = await import("crypto");

      const researchDir = _path.resolve(process.cwd(), "data", "uploads", "research");
      try {
        _fs.mkdirSync(researchDir, { recursive: true });
      } catch {}

      // 500 MB cap – large enough for Windows installers and Android APKs.
      // The ALLOWED_MIME map acts as the gate; octet-stream is always allowed
      // so the browser can send .exe/.apk files without spoofing MIME types.
      const upload = _multer({
        storage: _multer.memoryStorage(),
        limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
        fileFilter: (_req, file, cb) => {
          // Accept if MIME is in the whitelist OR if it looks like a known file
          // extension that the browser is sending as octet-stream.
          if (ALLOWED_MIME[file.mimetype]) return cb(null, true);
          const orig = (file.originalname || "").toLowerCase();
          const ok = [".apk", ".exe", ".zip", ".7z", ".tar", ".gz", ".bin",
            ".json", ".geojson", ".mp4"];
          if (ok.some((e) => orig.endsWith(e))) return cb(null, true);
          cb(new Error(
            "Unsupported file format. Allowed: PDF, DOCX, XLSX, PPTX, CSV, " +
            "PNG, JPG, ZIP, 7Z, APK, EXE, MP4, JSON, GeoJSON."
          ));
        },
      }).single("file");

      upload(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ message: err.message });
        }
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const ext = resolveExt(req.file);
        const rand = _crypto.randomBytes(8).toString("hex");
        const filename = `res-${Date.now()}-${rand}${ext}`;
        const fullPath = _path.join(researchDir, filename);

        await _fs.promises.writeFile(fullPath, req.file.buffer);
        const url = `/uploads/research/${filename}`;

        res.json({
          url,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
        });
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to upload file" });
    }
  }
);

// GET /api/research/filter-metadata - Unique values for filters (Public)
researchRouter.get("/filter-metadata", async (req: any, res) => {
  try {
    const docs = await db.select({
      documentType: researchDocuments.documentType,
      country: researchDocuments.country,
      year: researchDocuments.year,
    }).from(researchDocuments);

    const pilotsList = await db.select({
      country: pilotActivities.country,
      startDate: pilotActivities.startDate,
    }).from(pilotActivities);

    const docTypes = Array.from(new Set(docs.map((d) => d.documentType).filter(Boolean)));
    const countries = Array.from(
      new Set([
        ...docs.map((d) => d.country).filter(Boolean),
        ...pilotsList.map((p) => p.country).filter(Boolean),
      ])
    );
    const years = Array.from(
      new Set([
        ...docs.map((d) => Number(d.year)),
        ...pilotsList.map((p) => p.startDate ? new Date(p.startDate).getFullYear() : null),
      ])
    )
      .filter((y): y is number => y !== null && !isNaN(y))
      .sort((a, b) => b - a);

    res.json({ docTypes, countries, years });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch filter metadata" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH DOCUMENTS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/research/documents - Browse documents
researchRouter.get("/documents", loadDbUser, async (req: any, res) => {
  try {
    const { search, type, country, year, status, visibility, sort } = req.query;
    const isAdmin = isUserResearchAdmin(req.dbUser);

    const conditions: any[] = [];

    /* Original filters commented out to satisfy AI coding rules and prevent 'all' query values from filtering out database records:
    if (!isAdmin) {
      conditions.push(eq(researchDocuments.status, "Published"));
      conditions.push(eq(researchDocuments.visibility, "Public"));
    } else {
      if (status) conditions.push(eq(researchDocuments.status, String(status)));
      if (visibility) conditions.push(eq(researchDocuments.visibility, String(visibility)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(researchDocuments.title, `%${search}%`),
          ilike(researchDocuments.abstract, `%${search}%`),
          ilike(researchDocuments.authors, `%${search}%`)
        )
      );
    }
    if (type) conditions.push(eq(researchDocuments.documentType, String(type)));
    if (country) conditions.push(eq(researchDocuments.country, String(country)));
    if (year) conditions.push(eq(researchDocuments.year, Number(year)));
    */
    if (!isAdmin) {
      conditions.push(eq(researchDocuments.status, "Published"));
      conditions.push(eq(researchDocuments.visibility, "Public"));
    } else {
      if (status && status !== "all") conditions.push(eq(researchDocuments.status, String(status)));
      if (visibility && visibility !== "all") conditions.push(eq(researchDocuments.visibility, String(visibility)));
    }

    if (search) {
      conditions.push(
        or(
          ilike(researchDocuments.title, `%${search}%`),
          ilike(researchDocuments.abstract, `%${search}%`),
          ilike(researchDocuments.authors, `%${search}%`)
        )
      );
    }
    if (type && type !== "all") conditions.push(eq(researchDocuments.documentType, String(type)));
    if (country && country !== "all") conditions.push(eq(researchDocuments.country, String(country)));
    if (year && year !== "all") conditions.push(eq(researchDocuments.year, Number(year)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let order = desc(researchDocuments.createdAt);
    if (sort === "newest") order = desc(researchDocuments.createdAt);
    else if (sort === "downloads") order = desc(researchDocuments.downloadCount);
    else if (sort === "title") order = asc(researchDocuments.title);

    const docs = await db
      .select()
      .from(researchDocuments)
      .where(whereClause)
      .orderBy(order);

    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch documents" });
  }
});

// GET /api/research/documents/:id - Get detail
researchRouter.get("/documents/:id", loadDbUser, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const [doc] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, id)).limit(1);
    if (!doc) {
      return res.status(404).json({ message: "Document not found" });
    }

    const isAdmin = isUserResearchAdmin(req.dbUser);
    if (!isAdmin && (doc.status !== "Published" || doc.visibility !== "Public")) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch document" });
  }
});

// POST /api/research/documents - Create (Admin)
researchRouter.post(
  "/documents",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const parsed = insertResearchDocumentSchema.parse({
        ...req.body,
        tenantId: req.tenantId,
        createdByUserId: req.dbUser?.id || req.user?.id,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });

      // Automatically generate slug if missing
      const slugVal = parsed.slug || parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const [newDoc] = await db
        .insert(researchDocuments)
        .values({
          ...parsed,
          slug: slugVal,
          status: parsed.status || "Draft",
          visibility: parsed.visibility || "Public",
        })
        .returning();

      res.status(210).json(newDoc);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid payload" });
    }
  }
);

// PATCH /api/research/documents/:id - Edit (Admin)
researchRouter.patch(
  "/documents/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Document not found" });
      }

      const parsed = insertResearchDocumentSchema.partial().parse({
        ...req.body,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });

      const updateData: any = { ...parsed, updatedAt: new Date() };
      if (parsed.status === "Published" && existing.status !== "Published") {
        updateData.publishedAt = new Date();
        updateData.publishedByUserId = req.dbUser?.id || req.user?.id;
      } else if (parsed.status === "Archived" && existing.status !== "Archived") {
        updateData.archivedAt = new Date();
      }

      const [updated] = await db
        .update(researchDocuments)
        .set(updateData)
        .where(eq(researchDocuments.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid edit payload" });
    }
  }
);

// DELETE /api/research/documents/:id - Delete (Admin)
researchRouter.delete(
  "/documents/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Document not found" });
      }

      await db.delete(researchDocuments).where(eq(researchDocuments.id, id));
      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete document" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PILOT ACTIVITIES ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/research/pilots - Browse pilots
researchRouter.get("/pilots", loadDbUser, async (req: any, res) => {
  try {
    const { search, country, status, partner } = req.query;
    const isAdmin = isUserResearchAdmin(req.dbUser);

    const conditions: any[] = [];

    // Access control: public sees public visibility
    if (!isAdmin) {
      conditions.push(eq(pilotActivities.visibility, "Public"));
    }

    if (search) {
      conditions.push(
        or(
          ilike(pilotActivities.title, `%${search}%`),
          ilike(pilotActivities.summary, `%${search}%`),
          ilike(pilotActivities.partners, `%${search}%`)
        )
      );
    }
    /* Original filters commented out to satisfy AI coding rules and prevent 'all' status/country query values from filtering out database records:
    if (country) conditions.push(eq(pilotActivities.country, String(country)));
    if (status) conditions.push(eq(pilotActivities.status, String(status)));
    if (partner) conditions.push(ilike(pilotActivities.partners, `%${partner}%`));
    */
    if (country && country !== "all") conditions.push(eq(pilotActivities.country, String(country)));
    if (status && status !== "all") conditions.push(eq(pilotActivities.status, String(status)));
    if (partner) conditions.push(ilike(pilotActivities.partners, `%${partner}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(pilotActivities)
      .where(whereClause)
      .orderBy(desc(pilotActivities.createdAt));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch pilots" });
  }
});

// GET /api/research/pilots/:id - Get pilot detail with updates
researchRouter.get("/pilots/:id", loadDbUser, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const [pilot] = await db.select().from(pilotActivities).where(eq(pilotActivities.id, id)).limit(1);
    if (!pilot) {
      return res.status(404).json({ message: "Pilot not found" });
    }

    const isAdmin = isUserResearchAdmin(req.dbUser);
    if (!isAdmin && pilot.visibility !== "Public") {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = await db
      .select()
      .from(pilotUpdates)
      .where(eq(pilotUpdates.pilotId, id))
      .orderBy(desc(pilotUpdates.updateDate));

    res.json({ ...pilot, updates });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch pilot details" });
  }
});

// POST /api/research/pilots - Create Pilot (Admin)
researchRouter.post(
  "/pilots",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const parsed = insertPilotActivitySchema.parse({
        ...req.body,
        tenantId: req.tenantId,
        createdByUserId: req.dbUser?.id || req.user?.id,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });

      const slugVal = parsed.slug || parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const [newPilot] = await db
        .insert(pilotActivities)
        .values({
          ...parsed,
          slug: slugVal,
          status: parsed.status || "Planned",
          visibility: parsed.visibility || "Public",
        })
        .returning();

      res.status(210).json(newPilot);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid pilot payload" });
    }
  }
);

// PATCH /api/research/pilots/:id - Edit Pilot (Admin)
researchRouter.patch(
  "/pilots/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(pilotActivities).where(eq(pilotActivities.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Pilot not found" });
      }

      const parsed = insertPilotActivitySchema.partial().parse({
        ...req.body,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });

      const updateData: any = { ...parsed, updatedAt: new Date() };
      if (parsed.status === "Completed" && existing.status !== "Completed") {
        updateData.publishedAt = new Date();
      }

      const [updated] = await db
        .update(pilotActivities)
        .set(updateData)
        .where(eq(pilotActivities.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid edit payload" });
    }
  }
);

// DELETE /api/research/pilots/:id - Delete Pilot (Admin)
researchRouter.delete(
  "/pilots/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(pilotActivities).where(eq(pilotActivities.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Pilot not found" });
      }
      // Cascade: pilot_updates and implementation_lessons referencing this pilot
      // are deleted automatically via the FK onDelete cascade set in the schema.
      await db.delete(pilotActivities).where(eq(pilotActivities.id, id));
      res.json({ success: true, message: "Pilot deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete pilot" });
    }
  }
);

// POST /api/research/pilots/:id/updates - Add Pilot Status Update (Admin)
researchRouter.post(
  "/pilots/:id/updates",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const pilotId = Number(req.params.id);
      const [existing] = await db.select().from(pilotActivities).where(eq(pilotActivities.id, pilotId)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Pilot not found" });
      }

      const parsed = insertPilotUpdateSchema.parse({
        ...req.body,
        pilotId,
        createdByUserId: req.dbUser?.id || req.user?.id,
      });

      const [newUpdate] = await db.insert(pilotUpdates).values(parsed).returning();
      res.status(210).json(newUpdate);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid update payload" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION LESSONS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/research/lessons - Browse lessons
researchRouter.get("/lessons", loadDbUser, async (req: any, res) => {
  try {
    const { category, search } = req.query;
    const isAdmin = isUserResearchAdmin(req.dbUser);

    const conditions: any[] = [];
    if (!isAdmin) {
      conditions.push(eq(implementationLessons.visibility, "Public"));
      conditions.push(eq(implementationLessons.status, "Published"));
    }

    if (category) conditions.push(eq(implementationLessons.category, String(category)));
    if (search) {
      conditions.push(
        or(
          ilike(implementationLessons.title, `%${search}%`),
          ilike(implementationLessons.context, `%${search}%`),
          ilike(implementationLessons.whatWorked, `%${search}%`),
          ilike(implementationLessons.whatDidNotWork, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(implementationLessons)
      .where(whereClause)
      .orderBy(desc(implementationLessons.createdAt));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch lessons" });
  }
});

// POST /api/research/lessons - Create (Admin)
researchRouter.post(
  "/lessons",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const parsed = insertImplementationLessonSchema.parse({
        ...req.body,
        tenantId: req.tenantId,
        author: req.dbUser?.fullName || req.user?.displayName || "Admin",
      });

      const slugVal = parsed.slug || parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const [newLesson] = await db
        .insert(implementationLessons)
        .values({
          ...parsed,
          slug: slugVal,
          status: parsed.status || "Published",
          visibility: parsed.visibility || "Public",
        })
        .returning();

      res.status(210).json(newLesson);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid lesson payload" });
    }
  }
);

// PATCH /api/research/lessons/:id - Edit Lesson (Admin)
researchRouter.patch(
  "/lessons/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(implementationLessons).where(eq(implementationLessons.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      const parsed = insertImplementationLessonSchema.partial().parse({
        ...req.body,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });
      const [updated] = await db
        .update(implementationLessons)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(implementationLessons.id, id))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid lesson payload" });
    }
  }
);

// DELETE /api/research/lessons/:id - Delete Lesson (Admin)
researchRouter.delete(
  "/lessons/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(implementationLessons).where(eq(implementationLessons.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      await db.delete(implementationLessons).where(eq(implementationLessons.id, id));
      res.json({ success: true, message: "Lesson deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete lesson" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// DOWNLOAD ASSETS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/research/assets - Browse download center assets
researchRouter.get("/assets", loadDbUser, async (req: any, res) => {
  try {
    const { category, search } = req.query;
    const isAdmin = isUserResearchAdmin(req.dbUser);

    const conditions: any[] = [];
    if (!isAdmin) {
      conditions.push(eq(downloadAssets.visibility, "Public"));
      conditions.push(eq(downloadAssets.status, "Published"));
    }

    if (category) conditions.push(eq(downloadAssets.category, String(category)));
    if (search) {
      conditions.push(
        or(
          ilike(downloadAssets.title, `%${search}%`),
          ilike(downloadAssets.description, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(downloadAssets)
      .where(whereClause)
      .orderBy(desc(downloadAssets.createdAt));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch assets" });
  }
});

// POST /api/research/assets - Create (Admin)
researchRouter.post(
  "/assets",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const parsed = insertDownloadAssetSchema.parse({
        ...req.body,
        tenantId: req.tenantId,
        createdByUserId: req.dbUser?.id || req.user?.id,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });

      const slugVal = parsed.slug || parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const [newAsset] = await db
        .insert(downloadAssets)
        .values({
          ...parsed,
          slug: slugVal,
          status: parsed.status || "Published",
          visibility: parsed.visibility || "Public",
        })
        .returning();

      res.status(210).json(newAsset);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid asset payload" });
    }
  }
);

// PATCH /api/research/assets/:id - Edit Asset (Admin)
researchRouter.patch(
  "/assets/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(downloadAssets).where(eq(downloadAssets.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Asset not found" });
      }
      const parsed = insertDownloadAssetSchema.partial().parse({
        ...req.body,
        updatedByUserId: req.dbUser?.id || req.user?.id,
      });
      const [updated] = await db
        .update(downloadAssets)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(downloadAssets.id, id))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid asset payload" });
    }
  }
);

// DELETE /api/research/assets/:id - Delete Asset (Admin)
researchRouter.delete(
  "/assets/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(downloadAssets).where(eq(downloadAssets.id, id)).limit(1);
      if (!existing) {
        return res.status(404).json({ message: "Asset not found" });
      }
      await db.delete(downloadAssets).where(eq(downloadAssets.id, id));
      res.json({ success: true, message: "Asset deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete asset" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// COLLABORATION / INTEREST SUBMISSIONS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/research/submissions - Submit contact form (Public)
researchRouter.post("/submissions", async (req: any, res) => {
  try {
    const tenantId = req.tenantId || "default-tenant-uuid";
    const parsed = insertResearchInterestSubmissionSchema.parse({
      ...req.body,
      tenantId,
      status: "pending",
    });

    const [newSubmission] = await db.insert(researchInterestSubmissions).values(parsed).returning();
    res.status(210).json(newSubmission);
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Invalid submission payload" });
  }
});

// GET /api/research/submissions - List submissions (Admin)
researchRouter.get(
  "/submissions",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const list = await db
        .select()
        .from(researchInterestSubmissions)
        .where(eq(researchInterestSubmissions.tenantId, req.tenantId))
        .orderBy(desc(researchInterestSubmissions.createdAt));

      res.json(list);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch submissions" });
    }
  }
);

// PATCH /api/research/submissions/:id - Update submission status (Admin)
researchRouter.patch(
  "/submissions/:id",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status required" });
      }

      const [updated] = await db
        .update(researchInterestSubmissions)
        .set({ status, updatedAt: new Date() })
        .where(eq(researchInterestSubmissions.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update submission" });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// TRACK DOWNLOADS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/research/download/:id - Log download event
researchRouter.post("/download/:id", async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const { type } = req.body; // 'document' or 'asset'

    const crypto = await import("crypto");
    const ipHash = crypto.createHash("sha256").update(req.ip || "").digest("hex");

    if (type === "document") {
      const [doc] = await db.select().from(researchDocuments).where(eq(researchDocuments.id, id)).limit(1);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      await db
        .update(researchDocuments)
        .set({ downloadCount: doc.downloadCount + 1 })
        .where(eq(researchDocuments.id, id));

      await db.insert(researchDownloadEvents).values({
        documentId: id,
        ipHash,
        userAgent: req.headers["user-agent"] || null,
        userId: (req.user as any)?.id || null,
      });

      return res.json({ success: true, newCount: doc.downloadCount + 1 });
    } else if (type === "asset") {
      const [asset] = await db.select().from(downloadAssets).where(eq(downloadAssets.id, id)).limit(1);
      if (!asset) return res.status(404).json({ message: "Asset not found" });

      await db
        .update(downloadAssets)
        .set({ downloadCount: asset.downloadCount + 1 })
        .where(eq(downloadAssets.id, id));

      await db.insert(researchDownloadEvents).values({
        assetId: id,
        ipHash,
        userAgent: req.headers["user-agent"] || null,
        userId: (req.user as any)?.id || null,
      });

      return res.json({ success: true, newCount: asset.downloadCount + 1 });
    }

    res.status(400).json({ message: "Invalid type: must be document or asset" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to track download" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH ADMIN ANALYTICS SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/research/analytics - Overview counters (Admin)
researchRouter.get(
  "/analytics",
  isAuthenticated,
  requireTenant,
  loadDbUser,
  requireResearchAdmin,
  async (req: any, res) => {
    try {
      const tenantId = req.tenantId;

      const [docsTotal] = await db.select({ count: sql<number>`count(*)` }).from(researchDocuments);
      const [docsPublished] = await db
        .select({ count: sql<number>`count(*)` })
        .from(researchDocuments)
        .where(eq(researchDocuments.status, "Published"));
      const [docsDraft] = await db
        .select({ count: sql<number>`count(*)` })
        .from(researchDocuments)
        .where(eq(researchDocuments.status, "Draft"));

      const [pilotsTotal] = await db.select({ count: sql<number>`count(*)` }).from(pilotActivities);
      const [pilotsActive] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pilotActivities)
        .where(eq(pilotActivities.status, "Active"));
      const [pilotsCompleted] = await db
        .select({ count: sql<number>`count(*)` })
        .from(pilotActivities)
        .where(eq(pilotActivities.status, "Completed"));

      const countriesCount = await db.execute(
        sql`SELECT COUNT(DISTINCT country) as count FROM pilot_activities`
      );
      const totalCountries = Number(countriesCount.rows[0]?.count || 0);

      const downloadTotal = await db.execute(sql`
        SELECT (COALESCE(SUM(download_count), 0)) as total
        FROM (
          SELECT download_count FROM research_documents
          UNION ALL
          SELECT download_count FROM download_assets
        ) t
      `);
      const totalDownloads = Number(downloadTotal.rows[0]?.total || 0);

      const topDocuments = await db
        .select({
          id: researchDocuments.id,
          title: researchDocuments.title,
          downloadCount: researchDocuments.downloadCount,
        })
        .from(researchDocuments)
        .orderBy(desc(researchDocuments.downloadCount))
        .limit(5);

      /* Original submissionsCount query commented out to satisfy AI coding rules and apply tenant-scoped matching for inbox count:
      const [submissionsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(researchInterestSubmissions)
        .where(eq(researchInterestSubmissions.status, "pending"));
      */
      const [submissionsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(researchInterestSubmissions)
        .where(
          and(
            eq(researchInterestSubmissions.status, "pending"),
            eq(researchInterestSubmissions.tenantId, tenantId)
          )
        );

      res.json({
        documents: {
          total: Number(docsTotal?.count || 0),
          published: Number(docsPublished?.count || 0),
          draft: Number(docsDraft?.count || 0),
        },
        pilots: {
          total: Number(pilotsTotal?.count || 0),
          active: Number(pilotsActive?.count || 0),
          completed: Number(pilotsCompleted?.count || 0),
        },
        countries: totalCountries,
        totalDownloads,
        topDocuments,
        pendingSubmissions: Number(submissionsCount?.count || 0),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch analytics" });
    }
  }
);
