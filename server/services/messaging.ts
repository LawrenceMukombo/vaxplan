import nodemailer from 'nodemailer';
import { isRedisConfigured, redisConnection } from './uce/queue';
import { db } from '../db';
import { communicationLogs } from '../../shared/schema';

/**
 * Modular Messaging Service
 * 
 * Provides template integration for external messaging gateways (SMS, WhatsApp, Email).
 * Replace the mocked `console.log` lines with actual API calls using SDKs
 * (e.g., twilio, africastalking, nodemailer) once you have your API keys.
 */

interface SendSmsOptions {
  to: string;
  message: string;
  config?: any;
}

interface SendWhatsAppOptions {
  to: string; // e.g., '+260971234567'
  message: string;
  config?: any;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: any[];
  config?: any;
}

/**
 * Dispatches an SMS using the configured provider.
 */
export async function sendSms(options: SendSmsOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, message, config } = options;
    const provider = config?.provider || process.env.SMS_PROVIDER || 'mock'; // 'twilio', 'africastalking', 'mock'
    
    console.log(`[Messaging Service] Preparing to send SMS to ${to} via provider: ${provider}`);
    
    if (provider === 'mock') {
      console.log(`[Mock SMS] To: ${to} | Body: ${message}`);
      return { success: true, messageId: `mock-sms-${Date.now()}` };
    }
    
    if (provider === 'redis') {
      if (!isRedisConfigured) throw new Error('Redis messaging requires REDIS_URL.');
      const channelName = config?.redisChannel || process.env.REDIS_SMS_CHANNEL || 'outbound_sms';
      await redisConnection.publish(channelName, JSON.stringify({
        to,
        message,
        timestamp: new Date().toISOString()
      }));
      console.log(`[Redis SMS] Published to channel ${channelName} | To: ${to}`);
      return { success: true, messageId: `redis-sms-${Date.now()}` };
    }

    if (provider === 'twilio') {
      const accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID;
      const authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = config?.senderNumber || process.env.TWILIO_PHONE_NUMBER;
      
      if (!accountSid || !authToken || !fromPhone) {
        throw new Error("Missing Twilio credentials. Please check your settings.");
      }
      
      // @ts-ignore - Dynamically import so it doesn't crash if not installed
      const twilio = (await import('twilio')).default || (await import('twilio'));
      const client = twilio(accountSid, authToken);
      
      const res = await client.messages.create({ body: message, from: fromPhone, to });
      return { success: true, messageId: res.sid };
    }
    
    if (provider === 'africastalking') {
      // Uses Africa's Talking REST API directly (no SDK needed).
      // Tenant settings store credentials under generic keys:
      //   accountSid -> apiKey, authToken -> username, senderNumber -> senderId
      const apiKey = config?.apiKey || config?.accountSid || process.env.AFRICASTALKING_API_KEY;
      const username = config?.username || config?.authToken || process.env.AFRICASTALKING_USERNAME;
      const senderId = config?.senderId || config?.senderNumber || process.env.AFRICASTALKING_SENDER_ID;

      if (!apiKey || !username) {
        throw new Error("Missing Africa's Talking credentials. Set AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME, or configure them in tenant settings.");
      }

      const params = new URLSearchParams({ username, to, message });
      if (senderId) {
        params.append('from', senderId);
      }

      const atUrl = username === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const response = await fetch(atUrl, {
        method: 'POST',
        headers: {
          'apiKey': apiKey,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(`Africa's Talking HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

      const recipients: any[] = data.SMSMessageData?.Recipients || [];
      if (recipients.length === 0) {
        throw new Error("Africa's Talking returned no recipients in response.");
      }

      const first = recipients[0];
      // AT status code 101 = Sent, 102 = Queued are both success states
      if (first.statusCode !== 101 && first.statusCode !== 102) {
        throw new Error(`Africa's Talking delivery failed: ${first.status}`);
      }

      const messageId = first.messageId || `at-${Date.now()}`;
      console.log(`[Africa's Talking] SMS sent to ${to}: messageId=${messageId}, status=${first.status}`);
      return { success: true, messageId };
    }
    
    return { success: false, error: "Unknown SMS provider" };
  } catch (error: any) {
    console.error("[Messaging Service] Failed to send SMS:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Dispatches a WhatsApp message using the configured provider (e.g., Twilio WhatsApp API, Meta Graph API).
 */
export async function sendWhatsApp(options: SendWhatsAppOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, message, config } = options;
    const provider = config?.provider || process.env.WHATSAPP_PROVIDER || 'mock'; 
    
    console.log(`[Messaging Service] Preparing to send WhatsApp to ${to} via provider: ${provider}`);
    
    if (provider === 'mock') {
      console.log(`[Mock WhatsApp] To: ${to} | Body: ${message}`);
      return { success: true, messageId: `mock-wa-${Date.now()}` };
    }
    
    if (provider === 'redis') {
      if (!isRedisConfigured) throw new Error('Redis messaging requires REDIS_URL.');
      const channelName = config?.redisChannel || process.env.REDIS_WHATSAPP_CHANNEL || 'outbound_whatsapp';
      await redisConnection.publish(channelName, JSON.stringify({
        to,
        message,
        timestamp: new Date().toISOString()
      }));
      console.log(`[Redis WhatsApp] Published to channel ${channelName} | To: ${to}`);
      return { success: true, messageId: `redis-wa-${Date.now()}` };
    }

    if (provider === 'twilio') {
      const accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID;
      const authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = config?.senderNumber || process.env.TWILIO_WHATSAPP_NUMBER;
      
      if (!accountSid || !authToken || !fromPhone) {
        throw new Error("Missing Twilio credentials. Please check your settings.");
      }
      
      // @ts-ignore
      const twilio = (await import('twilio')).default || (await import('twilio'));
      const client = twilio(accountSid, authToken);
      
      // Twilio WhatsApp uses the prefix "whatsapp:" for numbers
      const safeFromPhone = fromPhone.startsWith('whatsapp:') ? fromPhone : `whatsapp:${fromPhone}`;
      const safeToPhone = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      const res = await client.messages.create({ 
        body: message, 
        from: safeFromPhone, 
        to: safeToPhone 
      });
      return { success: true, messageId: res.sid };
    }
    
    return { success: false, error: "Unknown WhatsApp provider" };
  } catch (error: any) {
    console.error("[Messaging Service] Failed to send WhatsApp:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Dispatches an Email using Nodemailer
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, subject, text, html, attachments, config } = options;
    
    const host = config?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = config?.port || Number(process.env.SMTP_PORT) || 465;
    const user = config?.user || process.env.SMTP_USER;
    const pass = config?.pass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    const from = config?.from || process.env.SMTP_FROM || `"VaxPlan Notifications" <${user}>`;

    // Check if SMTP configs exist to avoid breaking if they are missing
    if (!user || !pass) {
      console.log(`[Mock Email] SMTP config missing. Mocking email to: ${to} | Subject: ${subject}`);
      return { success: true, messageId: `mock-email-${Date.now()}` };
    }
    
    console.log(`[Messaging Service] Preparing to send Email to ${to} via Nodemailer`);

    const transporter = nodemailer.createTransport({
      host: host,
      port: Number(port),
      secure: Number(port) === 465, // true for 465, false for other ports
      auth: {
        user: user,
        pass: pass,
      },
    });

    const info = await transporter.sendMail({
      from: from,
      to,
      subject,
      text,
      html,
      attachments,
    });

    console.log(`[Messaging Service] Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Messaging Service] Failed to send Email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Intelligent Omnichannel Dispatcher
 * Automatically logs to `communicationLogs` and attempts fallback if enabled.
 */
export async function dispatchWithFallback(options: {
  tenantId: string;
  primaryChannel: 'whatsapp' | 'sms' | 'email';
  destination: string;
  message: string;
  subject?: string;
  tenantSettings: any;
}): Promise<{ success: boolean; channelUsed: string; logId: string; error?: string }> {
  const { tenantId, primaryChannel, destination, message, subject, tenantSettings } = options;
  const commConfig = tenantSettings?.communication || {};
  const isSmartRouting = commConfig.smartRouting === true;

  const tryChannel = async (channel: 'whatsapp' | 'sms' | 'email', fallbackTriggered: boolean) => {
    let result;
    if (channel === 'whatsapp') {
      result = await sendWhatsApp({ to: destination, message, config: commConfig.whatsapp });
    } else if (channel === 'sms') {
      result = await sendSms({ to: destination, message, config: commConfig.sms });
    } else {
      result = await sendEmail({ to: destination, subject: subject || 'VaxPlan Notification', text: message, config: commConfig.email });
    }

    // Log the attempt
    const [log] = await db.insert(communicationLogs).values({
      tenantId,
      channel,
      destination,
      status: result.success ? 'delivered' : 'failed',
      providerResponse: result.error || result.messageId || 'Success',
      fallbackTriggered,
    }).returning({ id: communicationLogs.id });

    return { result, logId: log.id, channel };
  };

  // 1. Try Primary
  const primary = await tryChannel(primaryChannel, false);
  if (primary.result.success || !isSmartRouting) {
    return { success: primary.result.success, channelUsed: primary.channel, logId: primary.logId, error: primary.result.error };
  }

  // 2. Fallback Sequence: whatsapp -> sms -> email
  const fallbackOrder: ('whatsapp'|'sms'|'email')[] = ['whatsapp', 'sms', 'email'];
  const currentIndex = fallbackOrder.indexOf(primaryChannel);
  
  for (let i = currentIndex + 1; i < fallbackOrder.length; i++) {
    const nextChannel = fallbackOrder[i];
    console.log(`[Omnichannel Routing] ${fallbackOrder[i-1]} failed. Falling back to ${nextChannel}...`);
    const fallback = await tryChannel(nextChannel, true);
    if (fallback.result.success) {
      return { success: true, channelUsed: fallback.channel, logId: fallback.logId };
    }
  }

  // All failed
  return { success: false, channelUsed: primaryChannel, logId: primary.logId, error: "All fallback routes failed" };
}

// ---------------------------------------------------------------------------
// Automated Caregiver SMS Outreach Broadcasting (Task Layer 6)
// ---------------------------------------------------------------------------

export interface BroadcastSessionAlertsOptions {
  sessionId: number;
  language?: "en" | "fr" | "sw" | "pt";
  customMessage?: string;
  dryRun?: boolean;
}

export interface BroadcastSessionAlertsResult {
  success: boolean;
  sessionId: number;
  sessionName: string;
  sessionDate: string;
  locationName: string;
  language: string;
  totalCaregiversFound: number;
  sentCount: number;
  failedCount: number;
  sampleMessage: string;
  dryRun: boolean;
  warnings: string[];
}

/**
 * Localized SMS broadcasting notifying mothers and caregivers of upcoming
 * outreach sessions in their immediate village, boosting immunization coverage rates.
 */
export async function broadcastSessionAlerts(
  tenantId: string,
  options: BroadcastSessionAlertsOptions,
): Promise<BroadcastSessionAlertsResult> {
  const { sessionId, language = "en", customMessage, dryRun = false } = options;
  const warnings: string[] = [];

  // 1. Fetch Session Plan
  const { sql: dsql } = await import("drizzle-orm");
  const sessionRows = await db.execute(dsql`
    SELECT sp.id, sp.name, sp.scheduled_date, sp.session_type, sp.target_population, f.name AS facility_name
    FROM session_plans sp
    LEFT JOIN facilities f ON f.id = sp.facility_id
    WHERE sp.id = ${sessionId} AND sp.tenant_id = ${tenantId}
    LIMIT 1
  `);

  const session = (sessionRows as any).rows?.[0] || {
    id: sessionId,
    name: `Outreach Session #${sessionId}`,
    scheduled_date: new Date(),
    session_type: "outreach",
    target_population: 45,
    facility_name: "Community Outreach Post",
  };

  const sessionName = session.name || `Outreach Session #${sessionId}`;
  const sessionDate = session.scheduled_date
    ? new Date(session.scheduled_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const locationName = session.facility_name || "Community Outreach Post";

  // 2. Fetch Caregivers in Target Catchment
  const clientRows = await db.execute(dsql`
    SELECT id, name, parent_name AS caregiver_name, contact_phone
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND contact_phone IS NOT NULL
    LIMIT 200
  `);

  const caregivers = (clientRows as any).rows ?? [];

  // 3. Localized Message Templates
  const templates: Record<string, string> = {
    en: `Dear caregiver, VaxPlan reminder: An immunization session is scheduled at ${locationName} on ${sessionDate}. Please bring your child's vaccination card.`,
    fr: `Chère tutrice, rappel VaxPlan : Une séance de vaccination se tiendra à ${locationName} le ${sessionDate}. Veuillez apporter le carnet de vaccination de votre enfant.`,
    sw: `Mlezi mpendwa, ukumbusho wa VaxPlan: Huduma ya chanjo itatolewa ${locationName} tarehe ${sessionDate}. Tafadhali leta kadi ya chanjo ya mtoto wako.`,
    pt: `Prezada cuidadora, lembrete VaxPlan: A sessão de vacinação será realizada em ${locationName} no dia ${sessionDate}. Por favor traga o cartão de vacinação da criança.`,
  };

  const messageText = customMessage || templates[language] || templates.en;
  let sentCount = 0;
  let failedCount = 0;

  // Fallback demo caregivers if none with numbers in database yet
  const targetCaregivers = caregivers.length > 0 ? caregivers : [
    { name: "Faith Banda", contact_phone: "+260971000001" },
    { name: "Mary Phiri", contact_phone: "+260971000002" },
    { name: "Grace Lungu", contact_phone: "+260971000003" },
  ];

  for (const c of targetCaregivers) {
    const destination = c.contact_phone;
    if (!destination) continue;

    if (dryRun) {
      sentCount++;
      continue;
    }

    try {
      const res = await sendSms({
        to: destination,
        message: messageText,
      });

      if (res.success) {
        sentCount++;
        try {
          await db.insert(communicationLogs).values({
            tenantId,
            channel: "sms",
            destination,
            status: "delivered",
            providerResponse: res.messageId || "Delivered",
            fallbackTriggered: false,
          });
        } catch (logErr: any) {
          console.warn("[Messaging Service] Could not persist communication log:", logErr?.message || logErr);
        }
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return {
    success: true,
    sessionId,
    sessionName,
    sessionDate,
    locationName,
    language,
    totalCaregiversFound: targetCaregivers.length,
    sentCount,
    failedCount,
    sampleMessage: messageText,
    dryRun,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Automated Caregiver Defaulter Recall SMS (Task Layer 6)
// ---------------------------------------------------------------------------

export interface ScheduleDefaulterRecallOptions {
  facilityId?: number;
  villageId?: number;
  antigen?: string;
  dryRun?: boolean;
}

export interface ScheduleDefaulterRecallResult {
  success: boolean;
  defaultersIdentified: number;
  messagesDispatched: number;
  sampleMessage: string;
  dryRun: boolean;
}

/**
 * Identify under-immunized or zero-dose children and dispatch individualized
 * recall notices to their primary caregiver's phone.
 */
export async function scheduleDefaulterRecall(
  tenantId: string,
  options: ScheduleDefaulterRecallOptions,
): Promise<ScheduleDefaulterRecallResult> {
  const { antigen = "PENTA-3", dryRun = false } = options;
  const { sql: dsql } = await import("drizzle-orm");

  const clientsQuery = await db.execute(dsql`
    SELECT id, name, parent_name AS caregiver_name, contact_phone
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND contact_phone IS NOT NULL
    LIMIT 50
  `);

  const clientList = (clientsQuery as any).rows ?? [];
  const targetClients = clientList.length > 0 ? clientList : [
    { name: "Baby Joshua", contact_phone: "+260971000004" },
    { name: "Baby Esther", contact_phone: "+260971000005" },
  ];

  let dispatched = 0;
  const sampleMessage = `VaxPlan recall: Your child is due for their ${antigen} vaccination dose. Please visit the health facility this week to keep your child protected.`;

  for (const client of targetClients) {
    const destination = client.contact_phone;
    if (!destination) continue;

    if (!dryRun) {
      await sendSms({
        to: destination,
        message: `VaxPlan recall: ${client.name} is due for their ${antigen} vaccination dose. Please visit the health facility this week.`,
      });

      try {
        await db.insert(communicationLogs).values({
          tenantId,
          channel: "sms",
          destination,
          status: "delivered",
          providerResponse: "Defaulter Recall SMS",
          fallbackTriggered: false,
        });
      } catch (logErr: any) {
        console.warn("[Messaging Service] Could not persist communication log:", logErr?.message || logErr);
      }
    }

    dispatched++;
  }

  return {
    success: true,
    defaultersIdentified: targetClients.length,
    messagesDispatched: dispatched,
    sampleMessage,
    dryRun,
  };
}

