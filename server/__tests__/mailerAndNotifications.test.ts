import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveSender, sendEmail } from "../services/mailer";
import {
  notifyUserAccountCreated,
  notifyUserPasswordChanged,
  notifyUserLoginDetected,
  notifyUserPasswordResetRequested,
} from "../services/notificationService";

describe("Mailer & Notification Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveSender", () => {
    it("parses SMTP_FROM with display name correctly", () => {
      process.env.SMTP_FROM = '"VaxPlan Notifications" <noreply@vaxplan.org>';
      process.env.SMTP_USER = "noreply@vaxplan.org";
      const sender = resolveSender(undefined);
      expect(sender.address).toBe("noreply@vaxplan.org");
      expect(sender.name).toBe("VaxPlan Notifications");
    });

    it("falls back to SMTP_USER if SMTP_FROM is not provided", () => {
      delete process.env.MAIL_FROM;
      delete process.env.SMTP_FROM;
      process.env.SMTP_USER = "admin@vaxplan.org";
      const sender = resolveSender(undefined);
      expect(sender.address).toBe("admin@vaxplan.org");
    });

    it("prioritizes tenant email settings over environment defaults", () => {
      process.env.SMTP_FROM = "global@vaxplan.org";
      const tenant = {
        id: "t1",
        name: "Tenant Zambia",
        code: "ZM",
        countryCode: "ZM",
        settings: {
          email: {
            fromAddress: "zambia@vaxplan.org",
            fromName: "VaxPlan Zambia",
          },
        },
      } as any;
      const sender = resolveSender(tenant);
      expect(sender.address).toBe("zambia@vaxplan.org");
      expect(sender.name).toBe("VaxPlan Zambia");
    });
  });

  describe("sendEmail console channel fallback", () => {
    it("returns channel console when no remote email provider is configured", async () => {
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SMTP_HOST;

      const res = await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        text: "Test content",
      });

      expect(res.ok).toBe(true);
      expect(res.channel).toBe("console");
    });
  });

  describe("Notification Functions", () => {
    it("triggers notifyUserAccountCreated without crashing", async () => {
      await expect(
        notifyUserAccountCreated({
          user: {
            id: "u1",
            email: "newuser@example.com",
            firstName: "John",
            lastName: "Doe",
            roles: ["facility_clerk"],
          },
          temporaryPassword: "TempPassword123!",
        })
      ).resolves.not.toThrow();
    });

    it("triggers notifyUserPasswordChanged without crashing", async () => {
      await expect(
        notifyUserPasswordChanged({
          user: {
            id: "u1",
            email: "user@example.com",
            firstName: "Jane",
          },
          isResetByAdmin: true,
          clientIp: "127.0.0.1",
        })
      ).resolves.not.toThrow();
    });

    it("triggers notifyUserLoginDetected without crashing", async () => {
      await expect(
        notifyUserLoginDetected({
          user: {
            id: "u1",
            email: "user@example.com",
          },
          clientIp: "192.168.1.1",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        })
      ).resolves.not.toThrow();
    });

    it("triggers notifyUserPasswordResetRequested without crashing", async () => {
      await expect(
        notifyUserPasswordResetRequested({
          email: "user@example.com",
          fullName: "User Test",
        })
      ).resolves.not.toThrow();
    });
  });
});
