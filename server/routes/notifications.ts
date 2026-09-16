import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { requireDbUser } from "../auth/loadDbUser";

export const notificationsRouter = Router();
notificationsRouter.use(isAuthenticated, requireDbUser);

// GET /api/notifications — fetch notifications for the authenticated user
notificationsRouter.get("/", async (req: any, res) => {
  try {
    const userId = req.dbUser!.id;
    const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const list = await storage.getNotificationsForUser(userId, { unreadOnly, limit });
    res.json(list);
  } catch (err: any) {
    console.error("GET /api/notifications failed:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// POST /api/notifications/:id/read — mark single notification as read
notificationsRouter.post("/:id/read", async (req: any, res) => {
  try {
    const ok = await storage.markNotificationRead(req.dbUser!.id, req.params.id);
    if (!ok) return res.status(404).json({ message: "Notification not found" });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("POST /api/notifications/:id/read failed:", err);
    res.status(500).json({ message: "Failed to mark notification read" });
  }
});

// POST /api/notifications/read-all — mark all notifications as read for current user
notificationsRouter.post("/read-all", async (req: any, res) => {
  try {
    const count = await storage.markAllNotificationsRead(req.dbUser!.id);
    res.json({ ok: true, count });
  } catch (err: any) {
    console.error("POST /api/notifications/read-all failed:", err);
    res.status(500).json({ message: "Failed to mark notifications read" });
  }
});

export default notificationsRouter;
