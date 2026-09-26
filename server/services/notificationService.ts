import { sendEmail, type SendEmailInput } from "./mailer";
import type { Tenant, SignupRequest } from "@shared/schema";
import { storage } from "../storage";

/**
 * Global & Tenant Notification Service
 * 
 * Dispatches automated, professional notification emails for:
 * 1. New user access / signup requests
 * 2. User account approval / rejection notices
 * 3. Country onboarding leads
 * 4. Microplan review and approval events
 */

const PLATFORM_ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || "info@vaxplan.org";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://vaxplan.org";

/**
 * 1. Alert platform admins and tenant managers when a new user requests platform access
 */
export async function notifyAdminNewSignupRequest(
  request: {
    fullName: string;
    email: string;
    requestedRole: string;
    justification?: string | null;
  },
  tenant?: Tenant,
): Promise<void> {
  const tenantName = tenant?.name || "VaxPlan Platform";
  const countryCode = tenant?.countryCode || "";
  const roleDisplay = request.requestedRole.replace(/_/g, " ").toUpperCase();
  const reviewUrl = `${APP_BASE_URL}/admin/signups`;

  const subject = `[VaxPlan Action Required] New Access Request: ${request.fullName} (${tenantName})`;

  const text = `A new user has submitted a self-service access request for VaxPlan.\n\n` +
    `Applicant Name: ${request.fullName}\n` +
    `Email Address: ${request.email}\n` +
    `Tenant / Country: ${tenantName} ${countryCode ? `(${countryCode})` : ""}\n` +
    `Requested Role: ${roleDisplay}\n` +
    (request.justification ? `Justification: ${request.justification}\n\n` : `\n`) +
    `Review and decide this request in the Admin Portal:\n${reviewUrl}\n\n` +
    `VaxPlan Immunization Intelligence Platform`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #0284c7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">VaxPlan Access Request</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p style="font-size: 15px;">A new user has submitted an access request for your platform.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr>
            <td style="padding: 8px 12px; background: #f8fafc; font-weight: bold; width: 35%;">Applicant:</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${request.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background: #f8fafc; font-weight: bold;">Work Email:</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${request.email}">${request.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background: #f8fafc; font-weight: bold;">Tenant / Country:</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background: #f8fafc; font-weight: bold;">Requested Role:</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #0284c7; font-weight: bold;">${roleDisplay}</td>
          </tr>
          ${
            request.justification
              ? `<tr>
            <td style="padding: 8px 12px; background: #f8fafc; font-weight: bold;">Justification:</td>
            <td style="padding: 8px 12px;">${request.justification}</td>
          </tr>`
              : ""
          }
        </table>
        <div style="text-align: center; margin: 28px 0 16px;">
          <a href="${reviewUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Review Access Request
          </a>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748b;">
        VaxPlan Digital Immunization Platform · <a href="${APP_BASE_URL}" style="color: #0284c7;">vaxplan.org</a>
      </div>
    </div>
  `;

  // Send to platform admin / notification inbox
  await sendEmail({
    to: PLATFORM_ADMIN_EMAIL,
    subject,
    text,
    html,
    tenant,
  }).catch((err) => console.error("[NotificationService] Admin signup alert failed:", err));
}

/**
 * 2. Notify a user when their signup request is approved or rejected
 */
export async function notifyUserSignupDecision(
  request: {
    fullName: string;
    email: string;
    requestedRole: string;
    status: "approved" | "rejected";
    decisionReason?: string | null;
  },
  tenant?: Tenant,
): Promise<void> {
  const isApproved = request.status === "approved";
  const tenantName = tenant?.name || "your Ministry of Health programme";
  const roleDisplay = request.requestedRole.replace(/_/g, " ").toUpperCase();
  const loginUrl = `${APP_BASE_URL}/`;

  const subject = isApproved
    ? `Your VaxPlan Access Request Has Been Approved – ${roleDisplay}`
    : `Update on your VaxPlan Access Request`;

  const text = isApproved
    ? `Dear ${request.fullName},\n\n` +
      `We are pleased to inform you that your access request for the VaxPlan Digital Microplanning & Immunization Intelligence Platform has been approved.\n\n` +
      `Account Details:\n` +
      `- Portal URL: ${loginUrl}\n` +
      `- Registered Email: ${request.email}\n` +
      `- Assigned Role: ${roleDisplay}\n` +
      `- Tenant: ${tenantName}\n\n` +
      `You can now sign in at ${loginUrl} using your registered email and password.\n\n` +
      `Warm regards,\n` +
      `VaxPlan Platform Administration\n${APP_BASE_URL}`
    : `Dear ${request.fullName},\n\n` +
      `Thank you for your interest in VaxPlan. Your access request for ${tenantName} was reviewed and could not be approved at this time.\n\n` +
      (request.decisionReason ? `Reason: ${request.decisionReason}\n\n` : "") +
      `If you believe this was in error, please contact your national or district administrator.\n\n` +
      `Warm regards,\n` +
      `VaxPlan Platform Administration`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: ${isApproved ? "#059669" : "#dc2626"}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">
          ${isApproved ? "Access Request Approved" : "Access Request Update"}
        </h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p style="font-size: 15px;">Dear <strong>${request.fullName}</strong>,</p>
        ${
          isApproved
            ? `<p>We are pleased to inform you that your access request for the <strong>VaxPlan Platform</strong> has been approved.</p>
               <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; margin: 16px 0;">
                 <p style="margin: 4px 0;"><strong>Portal:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
                 <p style="margin: 4px 0;"><strong>Email:</strong> ${request.email}</p>
                 <p style="margin: 4px 0;"><strong>Role:</strong> <span style="color: #059669; font-weight: bold;">${roleDisplay}</span></p>
                 <p style="margin: 4px 0;"><strong>Tenant:</strong> ${tenantName}</p>
               </div>
               <p>You can now sign in using your registered credentials to access your microplanning, logbook, and supervisory tools.</p>
               <div style="text-align: center; margin: 28px 0 16px;">
                 <a href="${loginUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                   Sign In to VaxPlan
                 </a>
               </div>`
            : `<p>Thank you for your interest in VaxPlan. Your access request for <strong>${tenantName}</strong> was reviewed and could not be approved at this time.</p>
               ${request.decisionReason ? `<p style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px;"><strong>Note:</strong> ${request.decisionReason}</p>` : ""}
               <p>If you believe this was in error, please contact your district or national health supervisor.</p>`
        }
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748b;">
        VaxPlan Digital Immunization Platform · <a href="${APP_BASE_URL}" style="color: #0284c7;">vaxplan.org</a>
      </div>
    </div>
  `;

  // Send to applicant
  await sendEmail({
    to: request.email,
    subject,
    text,
    html,
    tenant,
  }).catch((err) => console.error("[NotificationService] User signup decision notice failed:", err));

  // Also send a copy to info@vaxplan.org for system auditing
  await sendEmail({
    to: PLATFORM_ADMIN_EMAIL,
    subject: `[Audit Copy] Signup ${isApproved ? "Approved" : "Rejected"}: ${request.fullName} (${request.email})`,
    text,
    html,
    tenant,
  }).catch(() => {});
}

/**
 * 3. Alert platform admin when a country onboarding interest lead is received
 */
export async function notifyAdminNewCountryInterest(lead: {
  countryCode: string;
  countryName: string;
  organization?: string | null;
  fullName: string;
  email: string;
  requestedRole: string;
  justification?: string | null;
}): Promise<void> {
  const subject = `[VaxPlan Country Lead] New Onboarding Interest: ${lead.countryName} (${lead.countryCode})`;

  const text = `New country onboarding inquiry received on VaxPlan:\n\n` +
    `Country: ${lead.countryName} (${lead.countryCode})\n` +
    `Organization: ${lead.organization || "Not provided"}\n` +
    `Contact Name: ${lead.fullName}\n` +
    `Email: ${lead.email}\n` +
    `Role: ${lead.requestedRole}\n` +
    (lead.justification ? `Message: ${lead.justification}\n\n` : "\n\n") +
    `VaxPlan Platform Onboarding`;

  await sendEmail({
    to: PLATFORM_ADMIN_EMAIL,
    subject,
    text,
  }).catch((err) => console.error("[NotificationService] Lead alert failed:", err));
}

/**
 * 4. Notify a user when their account is created by an administrator
 */
export async function notifyUserAccountCreated(params: {
  user: {
    id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    roles?: string[] | null | unknown;
    role?: string | null;
    tenantId?: string | null;
  };
  tenant?: Tenant | null;
  temporaryPassword?: string | null;
  createdByAdminName?: string | null;
}): Promise<void> {
  const { user, tenant, temporaryPassword, createdByAdminName } = params;
  if (!user || !user.email) return;

  const tenantName = tenant?.name || "VaxPlan Platform";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
  const userRoles = Array.isArray(user.roles) && user.roles.length > 0
    ? (user.roles as string[])
    : [user.role || "facility_clerk"];
  const roleDisplay = userRoles.map((r) => String(r).replace(/_/g, " ").toUpperCase()).join(", ");
  const loginUrl = `${APP_BASE_URL}/`;

  const subject = `Welcome to VaxPlan – Your Account Has Been Created (${tenantName})`;

  const text =
    `Dear ${fullName},\n\n` +
    `An account has been created for you on the VaxPlan Digital Microplanning & Immunization Intelligence Platform for ${tenantName}.\n\n` +
    `Account Details:\n` +
    `- Portal URL: ${loginUrl}\n` +
    `- Registered Email: ${user.email}\n` +
    `- Assigned Role(s): ${roleDisplay}\n` +
    `- Program / Country: ${tenantName}\n` +
    (temporaryPassword ? `- Initial Password: ${temporaryPassword}\n  (Please sign in and change your password immediately)\n` : `- Password: Provided by your administrator or set upon activation\n`) +
    (createdByAdminName ? `Created by: ${createdByAdminName}\n\n` : `\n`) +
    `You can sign in to the platform at: ${loginUrl}\n\n` +
    `Warm regards,\n` +
    `VaxPlan Platform Administration\n${APP_BASE_URL}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #0284c7; padding: 22px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Welcome to VaxPlan</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p style="font-size: 15px;">Dear <strong>${fullName}</strong>,</p>
        <p>Your user account for the <strong>VaxPlan Digital Immunization Platform</strong> has been successfully created.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin: 18px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Registered Email:</strong></td>
              <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Assigned Role(s):</strong></td>
              <td style="padding: 6px 0; color: #0284c7; font-weight: bold;">${roleDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Tenant / Country:</strong></td>
              <td style="padding: 6px 0; color: #0f172a;">${tenantName}</td>
            </tr>
            ${
              temporaryPassword
                ? `<tr>
              <td style="padding: 6px 0; color: #64748b;"><strong>Initial Password:</strong></td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 15px; color: #059669; font-weight: bold;">${temporaryPassword}</td>
            </tr>`
                : ""
            }
          </table>
        </div>
        ${
          temporaryPassword
            ? `<p style="font-size: 13px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 10px; border-radius: 6px;">
                <strong>Security recommendation:</strong> Please sign in and update your password immediately from your account profile settings.
              </p>`
            : `<p style="font-size: 13px; color: #64748b;">
                If your administrator did not supply an initial password, you may use the "Forgot password" link on the sign-in page to request access.
              </p>`
        }
        <div style="text-align: center; margin: 26px 0 16px;">
          <a href="${loginUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Sign In to VaxPlan
          </a>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748b;">
        VaxPlan Digital Immunization Platform · <a href="${APP_BASE_URL}" style="color: #0284c7;">vaxplan.org</a>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html,
    tenant: tenant || undefined,
  });

  if (user.id && (user.tenantId || tenant?.id)) {
    await storage
      .createNotification({
        tenantId: (user.tenantId || tenant?.id)!,
        userId: user.id,
        type: "account_created",
        title: "Welcome to VaxPlan",
        body: `Your account has been activated with role: ${roleDisplay}.`,
        data: { roles: userRoles, timestamp: new Date().toISOString() },
      })
      .catch((err) => console.warn("[NotificationService] In-app notification creation skipped:", err?.message));
  }
}

/**
 * 5. Security alert when a user's password is changed or reset
 */
export async function notifyUserPasswordChanged(params: {
  user: {
    id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    tenantId?: string | null;
  };
  isResetByAdmin: boolean;
  changedBy?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null;
  clientIp?: string | null;
  tenant?: Tenant | null;
}): Promise<void> {
  const { user, isResetByAdmin, changedBy, clientIp, tenant } = params;
  if (!user || !user.email) return;

  const tenantName = tenant?.name || "VaxPlan Platform";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
  const changedByName = changedBy
    ? [changedBy.firstName, changedBy.lastName].filter(Boolean).join(" ").trim() || changedBy.email || "Administrator"
    : "Administrator";

  const changeMethod = isResetByAdmin
    ? `Administrative reset performed by ${changedByName}`
    : "Self-service password change";

  const timeString = new Date().toUTCString();
  const subject = `Security Alert: Your VaxPlan Password Was Changed`;

  const text =
    `Dear ${fullName},\n\n` +
    `This is an automated security notice to inform you that the password for your VaxPlan account (${user.email}) was updated.\n\n` +
    `Details of change:\n` +
    `- Timestamp: ${timeString}\n` +
    `- Action: ${changeMethod}\n` +
    `- IP Address: ${clientIp || "Internal / Protected"}\n` +
    `- Tenant / Country: ${tenantName}\n\n` +
    `IMPORTANT: If you initiated or authorized this change, you can safely ignore this email.\n` +
    `If you did NOT authorize this change, please contact your VaxPlan administrator immediately to protect your account.\n\n` +
    `Warm regards,\n` +
    `VaxPlan Platform Security\n${APP_BASE_URL}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">VaxPlan Security Alert</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p style="font-size: 15px;">Dear <strong>${fullName}</strong>,</p>
        <p>The password associated with your VaxPlan account (<strong>${user.email}</strong>) was successfully changed.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; margin: 16px 0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${timeString}</p>
          <p style="margin: 4px 0;"><strong>Update Type:</strong> ${changeMethod}</p>
          <p style="margin: 4px 0;"><strong>Originating IP:</strong> ${clientIp || "Protected / Internal"}</p>
          <p style="margin: 4px 0;"><strong>Workspace:</strong> ${tenantName}</p>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 14px; margin-top: 18px; color: #991b1b; font-size: 13px;">
          <strong>Did you not authorize this change?</strong><br/>
          If you did not request or make this change, your account credentials may be compromised. Please alert your system administrator immediately.
        </div>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748b;">
        VaxPlan Digital Immunization Platform · <a href="${APP_BASE_URL}" style="color: #0284c7;">vaxplan.org</a>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html,
    tenant: tenant || undefined,
  });

  if (user.id && (user.tenantId || tenant?.id)) {
    await storage
      .createNotification({
        tenantId: (user.tenantId || tenant?.id)!,
        userId: user.id,
        type: "security_alert",
        title: "Password Changed",
        body: `Your account password was updated (${isResetByAdmin ? "admin reset" : "user change"}).`,
        data: { timestamp: new Date().toISOString(), isResetByAdmin },
      })
      .catch((err) => console.warn("[NotificationService] In-app notification creation skipped:", err?.message));
  }
}

/**
 * 6. Security notice when a user account logs in
 */
export async function notifyUserLoginDetected(params: {
  user: {
    id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    tenantId?: string | null;
  };
  clientIp?: string | null;
  userAgent?: string | null;
  tenant?: Tenant | null;
}): Promise<void> {
  const { user, clientIp, userAgent, tenant } = params;
  if (!user || !user.email) return;

  const tenantName = tenant?.name || "VaxPlan Platform";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
  const timeString = new Date().toUTCString();
  const subject = `Security Notice: Successful Sign-in to VaxPlan (${user.email})`;

  let deviceDescription = "Web Browser";
  if (userAgent) {
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      deviceDescription = /iPad|Tablet/i.test(userAgent) ? "Tablet Device" : "Mobile Device";
    } else if (/Windows/i.test(userAgent)) {
      deviceDescription = "Windows Desktop";
    } else if (/Macintosh|Mac OS/i.test(userAgent)) {
      deviceDescription = "macOS Device";
    } else if (/Linux/i.test(userAgent)) {
      deviceDescription = "Linux Desktop";
    }
  }

  const text =
    `Dear ${fullName},\n\n` +
    `A new sign-in to your VaxPlan account (${user.email}) was detected.\n\n` +
    `Sign-in details:\n` +
    `- Timestamp: ${timeString}\n` +
    `- Device: ${deviceDescription}\n` +
    `- IP Address: ${clientIp || "Unknown"}\n` +
    `- Workspace / Country: ${tenantName}\n\n` +
    `If this was you, no action is needed.\n` +
    `If you did not sign in at this time, please change your password immediately and contact your administrator.\n\n` +
    `Warm regards,\n` +
    `VaxPlan Platform Security\n${APP_BASE_URL}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">New Sign-in Detected</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p style="font-size: 15px;">Dear <strong>${fullName}</strong>,</p>
        <p>Your VaxPlan account (<strong>${user.email}</strong>) was just accessed.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; margin: 16px 0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${timeString}</p>
          <p style="margin: 4px 0;"><strong>Device / Browser:</strong> ${deviceDescription}</p>
          <p style="margin: 4px 0;"><strong>IP Address:</strong> ${clientIp || "Unknown"}</p>
          <p style="margin: 4px 0;"><strong>Workspace:</strong> ${tenantName}</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">
          If this was you, you can safely disregard this notice. If you did not sign in, please update your password right away.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748b;">
        VaxPlan Digital Immunization Platform · <a href="${APP_BASE_URL}" style="color: #0284c7;">vaxplan.org</a>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html,
    tenant: tenant || undefined,
  });

  if (user.id && (user.tenantId || tenant?.id)) {
    await storage
      .createNotification({
        tenantId: (user.tenantId || tenant?.id)!,
        userId: user.id,
        type: "security_login",
        title: "New Sign-in Detected",
        body: `Sign-in from ${deviceDescription} (${clientIp || "network"}).`,
        data: { timestamp: new Date().toISOString(), ip: clientIp, device: deviceDescription },
      })
      .catch((err) => console.warn("[NotificationService] In-app notification creation skipped:", err?.message));
  }
}

/**
 * 7. Notify a user when a password reset is requested for their email
 */
export async function notifyUserPasswordResetRequested(params: {
  email?: string | null;
  fullName?: string | null;
  clientIp?: string | null;
  tenant?: Tenant | null;
}): Promise<void> {
  const { email, fullName, clientIp, tenant } = params;
  if (!email) return;

  const tenantName = tenant?.name || "VaxPlan Platform";
  const name = fullName || email;
  const timeString = new Date().toUTCString();
  const subject = `Password Reset Request – VaxPlan`;

  const text =
    `Dear ${name},\n\n` +
    `A password reset request was received for your VaxPlan account (${email}) on ${timeString}.\n\n` +
    `Your tenant administrator has been alerted with this request to assist you with resetting your credentials.\n` +
    `If you did not request this, you may safely ignore this message; your current password remains unchanged.\n\n` +
    `Warm regards,\n` +
    `VaxPlan Platform Administration\n${APP_BASE_URL}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
      <div style="background-color: #0284c7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Password Reset Request</h2>
      </div>
      <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
        <p style="font-size: 15px;">Dear <strong>${name}</strong>,</p>
        <p>A password reset request was received for your VaxPlan account (<strong>${email}</strong>) on ${timeString}.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 6px; margin: 16px 0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>Workspace:</strong> ${tenantName}</p>
          <p style="margin: 4px 0;"><strong>Request IP:</strong> ${clientIp || "Protected / Internal"}</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> Administrator alerted</p>
        </div>
        <p style="font-size: 13px; color: #64748b;">
          Your tenant administrator has received an audit notification to assist you with updating your credentials. If you did not make this request, you can safely ignore this email; your existing password remains safe.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748b;">
        VaxPlan Digital Immunization Platform · <a href="${APP_BASE_URL}" style="color: #0284c7;">vaxplan.org</a>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject,
    text,
    html,
    tenant: tenant || undefined,
  });
}

