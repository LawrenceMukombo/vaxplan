/**
 * server/auth.ts
 *
 * Core authentication utilities for VaxPlan.
 *
 * Local development (NODE_ENV !== "production"):
 *   - Uses an in-memory session store (no remote DB round-trip per request).
 *   - Provides a mock /api/login endpoint that logs in as any DB user by email.
 *
 * Production (NODE_ENV=production):
 *   - Uses connect-pg-simple (PostgreSQL-backed session store).
 *   - Real logins go through /api/auth/login-password (passwordAuth.ts) or
 *     tenant-configured OIDC (oidcAdapter.ts).
 */
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import { storage } from "./storage";
import { db } from "./db";
import { users, auditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
export const IS_LOCAL_DEV = process.env.NODE_ENV !== "production";
function envFlag(name: string): boolean | undefined {
  const raw = process.env[name];
  if (raw == null || raw === "") return undefined;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}
// --- Session store ---
// Local dev: in-memory (zero network latency, sessions reset on restart).
// Production: PostgreSQL (durable, shared across PM2 workers).
export function getSession() {
  const absoluteTimeoutMinutes = parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MINUTES || "480", 10);
  const sessionTtl = absoluteTimeoutMinutes * 60 * 1000;
  const cookieName = process.env.SESSION_COOKIE_NAME || "vaxplan.sid";
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (!IS_LOCAL_DEV) {
      throw new Error(
        "CRITICAL: SESSION_SECRET is not set in production environment!",
      );
    }
    console.warn("[auth] SESSION_SECRET not set - using temporary dev secret.");
    secret = "temporary_dev_session_secret_for_vaxplan";
  }
  const localHttpSession = envFlag("LOCAL_HTTP_SESSION") === true;
  const allowInsecureLocalCookie = IS_LOCAL_DEV || localHttpSession;
  let store: session.Store;
  const useMemorySessionStore =
    IS_LOCAL_DEV ||
    localHttpSession ||
    (process.env.SESSION_STORE === "memory" && process.env.NODE_ENV !== "production");
  if (useMemorySessionStore) {
    const MemStore = MemoryStore(session);
    store = new MemStore({ checkPeriod: 86_400_000 });
    console.log("[session] Using in-memory session store (local dev)");
  } else {
    const PgStore = connectPg(session);
    store = new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: Math.floor(sessionTtl / 1000), // ttl is in seconds
      tableName: "sessions",
    });
  }
  const explicitSecureCookie = envFlag("SESSION_SECURE_COOKIE");
  const secureCookie = allowInsecureLocalCookie
    ? (explicitSecureCookie ?? false)
    : true;
  const sameSiteCookie: "lax" | "none" = secureCookie ? "none" : "lax";
  return session({
    name: cookieName,
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: false, // Ensures cookie expiration is not endlessly extended
    cookie: {
      httpOnly: true,
      // Require secure cookies in production unless overridden
      secure: secureCookie,
      // Packaged native apps (Android/Windows) send cross-origin requests, so
      // the cookie must be SameSite=None + Secure in production. In local dev
      // we fall back to "lax" (no HTTPS).
      sameSite: sameSiteCookie,
    },
  });
}
// --- Local-dev mock login ---
export async function setupAuth(app: Express, sessionMiddleware: RequestHandler = getSession()) {
  app.set("trust proxy", 1);
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
  // /api/logout must be registered in ALL environments (production + dev).
  // It must live ABOVE the IS_LOCAL_DEV early-return below so it is never
  // blocked by that guard. The route destroys the server-side session and
  // redirects to '/' (the login / landing page).
  app.get("/api/logout", async (req: any, res) => {
    const reason = typeof req.query.reason === "string" ? req.query.reason : "manual_logout";
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const cookieName = process.env.SESSION_COOKIE_NAME || "vaxplan.sid";
    const wantsJson =
      req.query.format === "json" ||
      (req.get("accept") || "").toLowerCase().includes("application/json");

    if (userId) {
      const isIdleTimeout = reason === "idle_timeout";
      try {
        await db.insert(auditLogs).values({
          userId: userId,
          tenantId: tenantId,
          action: isIdleTimeout ? "IDLE_TIMEOUT_LOGOUT" : "USER_LOGOUT",
          entityType: "User",
          entityId: 0,
          oldValue: null,
          newValue: {
            message: isIdleTimeout
              ? "User session logged out automatically due to inactivity"
              : "User logged out",
            reason,
          },
          ipAddress: req.ip || req.socket.remoteAddress
        });
      } catch (e) {
        console.error("Failed to insert logout audit log:", e);
      }
    }

    const finish = () => {
      res.clearCookie(cookieName, { path: "/" });
      if (wantsJson) {
        return res.status(200).json({ success: true });
      }
      return res.redirect("/");
    };

    if (typeof req.session?.destroy === "function") {
      req.session.destroy(finish);
    } else if (typeof req.logout === "function") {
      req.logout(finish);
    } else {
      finish();
    }
  });
  app.post("/api/auth/ping", isAuthenticated, (req, res) => {
    if (req.isAuthenticated?.() && req.session) {
      const now = Math.floor(Date.now() / 1000);
      const session = req.session as any;
      if (!session.createdAt) {
        session.createdAt = now;
      }
      // Throttle updating lastActive to once per minute to avoid excessive DB writes
      if (!session.lastActive || now - session.lastActive >= 60) {
        session.lastActive = now;
      }
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  });
  app.post("/api/auth/user-idle-timeout", isAuthenticated, (req, res) => {
    if (req.session) {
      const { idleTimeout } = req.body;
      const parsed = parseInt(idleTimeout, 10);
      if (idleTimeout === "default") {
        delete (req.session as any).userIdleTimeout;
      } else if (!isNaN(parsed)) {
        (req.session as any).userIdleTimeout = parsed;
      }
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "No session active" });
    }
  });
  app.get("/api/auth/session-config", (req, res) => {
    res.json({
      idleTimeoutMinutes: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || "15", 10),
      absoluteTimeoutMinutes: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MINUTES || "480", 10),
      warningMinutes: parseInt(process.env.SESSION_WARNING_BEFORE_TIMEOUT_MINUTES || "2", 10),
    });
  });
  // Only register dev-only mock login routes in local dev.
  if (!IS_LOCAL_DEV) {
    console.log("[auth] Production mode - mock login routes disabled.");
    return;
  }
  console.log("[auth] Local dev mode - mock login available at /api/login");
  app.get("/api/login", async (req, res) => {
    // Resolve tenant (default: first active tenant, prefer ZMB then PNG).
    let tenant = await storage.getTenantByCode("ZMB");
    if (!tenant) tenant = await storage.getTenantByCode("PNG");
    if (!tenant) {
      const active = await storage.listActiveTenants();
      tenant = active[0] ?? null;
    }
    const tenantId = tenant?.id ?? null;
    const emailParam = req.query.email
      ? String(req.query.email).toLowerCase()
      : "dev.admin@vaxplan.org";
    let dbUser = await storage.getUserByEmail(emailParam);
    if (!dbUser) {
      const sub =
        emailParam === "dev.admin@vaxplan.org"
          ? "dev-user-id"
          : `mock-user-${Date.now()}`;
      const nameParts = emailParam.split("@")[0].split(".");
      const firstName =
        nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
      const lastName = nameParts[1]
        ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1)
        : "User";
      await storage.upsertUser({
        id: sub,
        email: emailParam,
        firstName,
        lastName,
        profileImageUrl: null,
      });
      dbUser = await storage.getUserByEmail(emailParam);
      if (dbUser && tenantId && !dbUser.tenantId) {
        const isAdmin =
          emailParam === "dev.admin@vaxplan.org" ||
          emailParam === "national.admin@vaxplan.org";
        const role: string = isAdmin ? "national_admin" : "facility_clerk";
        await db
          .update(users)
          .set({ tenantId, role: role as any, roles: [role], updatedAt: new Date() })
          .where(eq(users.id, dbUser.id));
        dbUser = await storage.getUserByEmail(emailParam);
      }
    }
    if (!dbUser) {
      return res.status(400).send("Failed to retrieve or create mock user");
    }
    const mockUser = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      role: dbUser.role ?? "facility_clerk",
      roles: dbUser.roles ?? [],
      permissions: dbUser.permissions ?? [],
      dataAccessScope: dbUser.dataAccessScope ?? {
        provinces: [],
        districts: [],
        facilities: [],
      },
      tenantId: dbUser.tenantId ?? tenantId,
      claims: {
        sub: dbUser.id,
        email: dbUser.email,
        first_name: dbUser.firstName,
        last_name: dbUser.lastName,
      },
      access_token: "mock-access-token",
      refresh_token: null, // explicitly null - no OIDC refresh in local dev
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    };
    req.login(mockUser, (err) => {
      if (err) {
        console.error("[auth] mock login failed:", err);
        return res.status(500).send("Login failed");
      }
      res.redirect("/");
    });
  });
  app.get("/api/callback", (_req, res) => res.redirect("/"));
  // Note: /api/logout is registered once above (before the IS_LOCAL_DEV
  // guard) and is intentionally not duplicated here for local dev.
  // The route above handles both production and dev environments correctly.
}
// --- isAuthenticated middleware ---
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!req.isAuthenticated?.() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized", reason: "unauthenticated" });
  }
  const now = Math.floor(Date.now() / 1000);
  const session = req.session as any;
  const cookieName = process.env.SESSION_COOKIE_NAME || "vaxplan.sid";
  if (session && !session.createdAt) {
    session.createdAt = now;
  }
  if (session && !session.lastActive) {
    session.lastActive = now;
  }
  // 1. Enforce absolute timeout
  const absoluteTimeoutMinutes = parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MINUTES || "480", 10);
  if (session?.createdAt) {
    if (now - session.createdAt > absoluteTimeoutMinutes * 60) {
      if (typeof req.session?.destroy === "function") {
        req.session.destroy(() => {});
      }
      res.clearCookie(cookieName, { path: "/" });
      return res.status(401).json({ message: "Session expired due to absolute timeout limit.", reason: "absolute_timeout" });
    }
  }
  // 2. Enforce server-side idle timeout (backend source of truth)
  let idleTimeoutMinutes = parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || "15", 10);
  if (session && session.userIdleTimeout !== undefined) {
    const customTimeout = parseInt(session.userIdleTimeout, 10);
    if (!isNaN(customTimeout)) {
      idleTimeoutMinutes = customTimeout;
    }
  }
  if (idleTimeoutMinutes > 0 && session?.lastActive) {
    if (now - session.lastActive > idleTimeoutMinutes * 60) {
      if (typeof req.session?.destroy === "function") {
        req.session.destroy(() => {});
      }
      res.clearCookie(cookieName, { path: "/" });
      return res.status(401).json({ message: "Session expired due to inactivity.", reason: "idle_timeout" });
    }
  }
  if (now <= user.expires_at) {
    return next();
  }
  // In local dev the mock token has no real refresh path.
  // Expired sessions require a fresh /api/login.
  if (IS_LOCAL_DEV || !user.refresh_token) {
    return res
      .status(401)
      .json({ message: "Session expired - please log in again." });
  }
  // Production: attempt OIDC token refresh via oidcAdapter if needed.
  // (The tenant-OIDC flow handled by oidcAdapter.ts sets expires_at from
  //  the real token; password-auth sessions have a 7-day expiry so they
  //  rarely hit this branch.)
  return res.status(401).json({ message: "Session expired." });
};
// --- User-id helpers ---
/**
 * Extracts the caller's user-id from the session.
 * OIDC sessions store it under `claims.sub`; local dev mock under `id`.
 */
export function getCurrentUserId(req: any): string {
  return (req?.user?.claims?.sub ?? req?.user?.id ?? "") as string;
}
/**
 * Returns the caller's DB user row, upserting it from session claims when it
 * doesn't exist yet (e.g. first OIDC sign-in race).
 */
export async function ensureDbUserFromSession(req: any) {
  const userId = getCurrentUserId(req);
  if (!userId) return null;
  const existing = await storage.getUser(userId);
  if (existing) return existing;
  // Try to create from session claims (OIDC path).
  const claims = req?.user?.claims;
  if (claims?.sub && claims?.email) {
    await storage.upsertUser({
      id: claims.sub,
      email: claims.email,
      firstName: claims.first_name ?? claims.given_name ?? null,
      lastName: claims.last_name ?? claims.family_name ?? null,
      profileImageUrl: claims.profile_image_url ?? claims.picture ?? null,
    });
    return (await storage.getUser(userId)) ?? null;
  }
  return null;
}
