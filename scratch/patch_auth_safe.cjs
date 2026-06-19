const fs = require('fs');

const file = 'c:\\vaxplan\\VaxPlan\\server\\auth.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add auditLogs to import
if (!content.includes('import { users, auditLogs } from "@shared/schema";') && !content.includes('import { auditLogs')) {
  content = content.replace(
    'import { users } from "@shared/schema";',
    'import { users, auditLogs } from "@shared/schema";'
  );
}

// 2. Replace the /api/logout handler exactly
const oldLogoutHandler = `  app.get("/api/logout", (req: any, res) => {
    // Destroy the server-side session (connect-pg-simple / memorystore).
    if (typeof req.session?.destroy === "function") {
      req.session.destroy(() => {
        res.clearCookie("connect.sid", { path: "/" });
        res.redirect("/");
      });
    } else {
      // Fallback: passport logout + redirect.
      req.logout?.(() => {
        res.clearCookie("connect.sid", { path: "/" });
        res.redirect("/");
      });
    }
  });`;

const newLogoutHandler = `  app.get("/api/logout", async (req: any, res) => {
    const reason = req.query.reason;
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (reason === "idle_timeout" && userId) {
      try {
        await db.insert(auditLogs).values({
          userId: userId,
          tenantId: tenantId,
          action: "IDLE_TIMEOUT_LOGOUT",
          entityType: "User",
          entityId: 0,
          oldValue: null,
          newValue: { message: "User session logged out automatically due to inactivity" },
          ipAddress: req.ip || req.socket.remoteAddress
        });
      } catch (e) {
        console.error("Failed to insert idle timeout audit log:", e);
      }
    }

    if (typeof req.session?.destroy === "function") {
      req.session.destroy(() => {
        res.clearCookie("connect.sid", { path: "/" });
        res.redirect("/");
      });
    } else {
      req.logout?.(() => {
        res.clearCookie("connect.sid", { path: "/" });
        res.redirect("/");
      });
    }
  });`;

if (content.includes(oldLogoutHandler)) {
  content = content.replace(oldLogoutHandler, newLogoutHandler);
} else if (!content.includes('reason === "idle_timeout"')) {
  console.log("Could not find exact old logout handler, please check.");
}

fs.writeFileSync(file, content);
console.log("auth.ts safely patched!");
