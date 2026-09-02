import { sendEmail, type SendEmailInput } from "./mailer";
import type { Tenant, SignupRequest } from "@shared/schema";

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
  const tenantName = tenant?.name || "Republic of South Africa National Department of Health";
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
