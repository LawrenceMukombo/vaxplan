const fs = require('fs');

const file = 'c:\\vaxplan\\VaxPlan\\server\\auth.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { auditLogs } from "@shared/schema";')) {
  // Try to find the imports
  if (content.includes('import { users, type User } from "@shared/schema";')) {
    content = content.replace(
      'import { users, type User } from "@shared/schema";',
      'import { users, auditLogs, type User } from "@shared/schema";'
    );
  }
}

if (!content.includes('reason === "idle_timeout"')) {
  // We need to inject the audit log
  const newLogoutHandler = `
  app.get("/api/logout", async (req: any, res) => {
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
  });
`;

  // Find the old app.get("/api/logout", ...
  const regex = /app\.get\("\/api\/logout",\s*\([^\)]+\)\s*=>\s*\{[\s\S]*?\}\);/;
  if (regex.test(content)) {
    content = content.replace(regex, newLogoutHandler.trim());
  } else {
    console.log("Could not find /api/logout handler to replace");
  }
}

fs.writeFileSync(file, content);
console.log("auth.ts patched successfully.");
