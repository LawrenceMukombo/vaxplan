import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { partnerEnquiries, partnerOutreachEvents } from "@shared/schema";
import { sendEmail } from "../services/mailer";

const INTERESTS = ["Demonstration", "Country Pilot", "GIS Microplanning", "Zero-Dose", "Campaign Management", "Interoperability", "Research", "Funding Partnership", "Technical Partnership", "Other"] as const;
const enquirySchema = z.object({
  name: z.string().trim().min(2).max(160),
  organisation: z.string().trim().min(2).max(255),
  role: z.string().trim().max(160).optional().default(""),
  country: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  interest: z.enum(INTERESTS),
  message: z.string().trim().min(20).max(4000),
  website: z.string().max(200).optional(), // honeypot; non-empty submissions are silently discarded
  referrer: z.string().trim().max(500).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

const eventSchema = z.object({
  eventName: z.enum(["partners_page_view", "demo_page_view", "pdf_download", "demo_start", "demo_complete", "request_demo_click", "partner_form_submit"]),
  path: z.string().trim().max(300),
  interest: z.string().trim().max(80).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
});

const buckets = new Map<string, { count: number; resetAt: number }>();
function limited(req: Request, max = 8): boolean {
  const key = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > max;
}

const STAGES = ["new", "qualified", "demo_scheduled", "concept_shared", "pilot_discussion", "closed"] as const;

export function registerPartnerRoutes(
  app: Express,
  adminMiddleware: RequestHandler[] = [],
) {
  app.post("/api/public/partner-enquiries", async (req, res) => {
    if (limited(req)) return res.status(429).json({ message: "Too many requests. Please try again later." });
    const parsed = enquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Please check the required fields." });
    if (parsed.data.website) return res.status(202).json({ success: true });
    const { website: _website, ...values } = parsed.data;
    const [created] = await db.insert(partnerEnquiries).values(values).returning({ id: partnerEnquiries.id });
    void sendEmail({
      to: process.env.PARTNERSHIP_EMAIL || "info@vaxplan.org",
      subject: `[VaxPlan Partnership] ${values.interest} - ${values.organisation}`,
      text: `New institutional enquiry\n\nName: ${values.name}\nOrganisation: ${values.organisation}\nRole: ${values.role || "Not provided"}\nCountry: ${values.country}\nEmail: ${values.email}\nInterest: ${values.interest}\n\n${values.message}\n\nReference: ${created.id}`,
    }).catch((error) => console.warn("[partners] notification email failed", error));
    res.status(201).json({ success: true, reference: created.id });
  });

  app.post("/api/public/partner-events", async (req, res) => {
    if (limited(req, 60)) return res.status(204).end();
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(204).end();
    try {
      await db.insert(partnerOutreachEvents).values(parsed.data);
    } catch (err) {
      // Safe fallback: non-blocking operational event logging
    }
    res.status(204).end();
  });

  app.get("/api/admin/partner-enquiries", ...adminMiddleware, async (_req, res) => {
    try {
      const rows = await db.select().from(partnerEnquiries).orderBy(desc(partnerEnquiries.createdAt)).limit(250);
      res.json(rows);
    } catch (err) {
      res.json([]);
    }
  });

  app.patch("/api/admin/partner-enquiries/:id/stage", ...adminMiddleware, async (req, res) => {
    const parsed = z.object({ stage: z.enum(STAGES) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid enquiry stage." });
    try {
      const [updated] = await db.update(partnerEnquiries)
        .set({ stage: parsed.data.stage, updatedAt: new Date() })
        .where(eq(partnerEnquiries.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Enquiry not found." });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update enquiry stage" });
    }
  });

  app.get("/api/admin/partner-analytics", ...adminMiddleware, async (_req, res) => {
    try {
      const events = await db.select().from(partnerOutreachEvents)
        .orderBy(desc(partnerOutreachEvents.createdAt)).limit(5000);
      const totals = events.reduce<Record<string, number>>((acc, event) => {
        acc[event.eventName] = (acc[event.eventName] || 0) + 1;
        return acc;
      }, {});
      res.json({ totals, sampledEvents: events.length });
    } catch (err) {
      res.json({ totals: {}, sampledEvents: 0 });
    }
  });
}
