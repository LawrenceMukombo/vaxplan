import { Worker, Job } from 'bullmq';
import { redisConnection, UceJobPayload, communicationQueue } from './queue';
import { db } from '../../db';
import { communicationChannels, deliveryLogs, communications } from '@shared/schema';
import { sendSms, sendWhatsApp, sendEmail } from '../messaging';
import { eq } from 'drizzle-orm';

function renderTemplateMessage(templateName: string, data: Record<string, any> = {}): { subject: string; body: string } {
  if (data.messageText && typeof data.messageText === "string") {
    return {
      subject: data.subject || "VaxPlan Notification",
      body: data.messageText,
    };
  }

  switch (templateName) {
    case "immunization_reminder":
    case "dose_due":
      return {
        subject: data.subject || "Immunization Reminder",
        body: `Dear Parent/Guardian, reminder that ${data.child_name || "your child"} is scheduled for vaccination (${data.vaccine || "routine immunization"}) on ${data.date || "your next session date"} at ${data.facility_name || "your local health facility"}.`,
      };
    case "defaulter_recall":
      return {
        subject: data.subject || "Urgent Immunization Follow-Up",
        body: `Dear Caregiver, ${data.child_name || "your child"} is due for missed vaccine dose (${data.vaccine || "vaccination"}). Please visit ${data.facility_name || "the nearest health clinic"} as soon as possible.`,
      };
    case "stockout_alert":
    case "cold_chain_alert":
      return {
        subject: data.subject || "Cold Chain & Stock Alert",
        body: `VaxPlan Alert for ${data.facility_name || "Facility"}: ${data.alert_type || "Cold chain / stock event"} reported. Current status: ${data.details || "Requires immediate review"}.`,
      };
    case "supervision_notice":
      return {
        subject: data.subject || "Supervision Visit Scheduled",
        body: `Supervision visit scheduled for ${data.facility_name || "your facility"} on ${data.scheduled_date || data.date || "the upcoming scheduled date"}. Supervisor: ${data.supervisor_name || "EPI Supervisor"}.`,
      };
    case "test_notification":
    case "test_email":
      return {
        subject: data.subject || "VaxPlan Notification Engine Test",
        body: data.messageText || `VaxPlan notification test for ${data.child_name || "recipient"} dispatched successfully.`,
      };
    default:
      if (data.text) return { subject: data.subject || "VaxPlan Notification", body: String(data.text) };
      if (data.message) return { subject: data.subject || "VaxPlan Notification", body: String(data.message) };
      return {
        subject: data.subject || `Notification: ${templateName.replace(/_/g, " ")}`,
        body: Object.entries(data)
          .filter(([k]) => !["phone", "email", "subject"].includes(k))
          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
          .join("\n") || `Notification for ${templateName.replace(/_/g, " ")}`,
      };
  }
}

/**
 * Intelligent Router that processes UCE Jobs
 */
export const communicationWorker = new Worker<UceJobPayload>(
  'communication-queue',
  async (job: Job<UceJobPayload>) => {
    const { communicationId, recipientId, channel, templateName, templateData, tenantId } = job.data;
    
    console.log(`[UCE Worker] Processing job ${job.id} for communication ${communicationId} on channel ${channel}`);

    // Mark attempt in communication_channels
    const [channelRecord] = await db.insert(communicationChannels).values({
      communicationId,
      channel,
      attempted: true,
      deliveryTime: new Date(),
    }).returning();

    // Render human-readable message content from template
    const rendered = renderTemplateMessage(templateName, templateData || {});
    const messageBody = rendered.body;
    const messageSubject = rendered.subject;

    let dispatchResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: 'Unknown channel', messageId: '' };

    try {
      // Fetch Tenant Configuration to pass down
      let commConfig = null;
      if (tenantId) {
        const { tenants } = await import('@shared/schema');
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
        if (tenant && tenant.settings && (tenant.settings as any).communication) {
          commConfig = (tenant.settings as any).communication[channel];
        }
      }

      // Dispatch based on channel
      switch (channel) {
        case 'whatsapp':
          dispatchResult = await sendWhatsApp({ to: templateData.phone || '', message: messageBody, config: commConfig });
          break;
        case 'sms':
          dispatchResult = await sendSms({ to: templateData.phone || '', message: messageBody, config: commConfig });
          break;
        case 'email':
          dispatchResult = await sendEmail({ to: templateData.email || '', subject: messageSubject, text: messageBody, config: commConfig });
          break;
        // Mock push & voice
        case 'push':
        case 'voice':
          console.log(`[UCE] Mocking ${channel} dispatch to ${recipientId}`);
          dispatchResult = { success: true, messageId: `mock-${channel}-${Date.now()}` };
          break;
      }

      // Log delivery result
      await db.insert(deliveryLogs).values({
        communicationId,
        provider: channel,
        status: dispatchResult.success ? 'delivered' : 'failed',
        response: dispatchResult.error || dispatchResult.messageId || 'Success',
      });

      if (dispatchResult.success) {
        // Update communication channel status
        await db.update(communicationChannels)
          .set({ delivered: true, responseCode: dispatchResult.messageId })
          .where(eq(communicationChannels.id, channelRecord.id));

        // Mark communication as completed
        await db.update(communications)
          .set({ status: 'completed' })
          .where(eq(communications.id, communicationId));
          
        return { status: 'delivered', channel };
      } else {
        throw new Error(dispatchResult.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error(`[UCE Worker] Failed dispatching on ${channel}:`, err.message);
      
      // FALLBACK LOGIC
      // If WhatsApp fails, try SMS. If SMS fails, try Push, etc.
      let nextChannel: UceJobPayload['channel'] | null = null;
      let delayMs = 5 * 60 * 1000; // default 5 minutes delay for fallback
      
      switch (channel) {
        case 'whatsapp':
          nextChannel = 'sms';
          delayMs = 0; // fallback to SMS immediately
          break;
        case 'sms':
          nextChannel = 'push';
          break;
        case 'push':
          nextChannel = 'email';
          break;
        case 'email':
          nextChannel = 'voice';
          break;
      }

      if (nextChannel) {
        console.log(`[UCE Worker] Fallback engaged: Enqueuing ${nextChannel} for communication ${communicationId}`);
        await communicationQueue.add(`fallback-${nextChannel}`, {
          ...job.data,
          channel: nextChannel
        }, { delay: delayMs });
      } else {
        // Ultimate failure
        await db.update(communications)
          .set({ status: 'failed' })
          .where(eq(communications.id, communicationId));
      }
      
      throw err;
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  }
);

communicationWorker.on('completed', job => {
  console.log(`[UCE Worker] Job ${job.id} completed successfully`);
});

communicationWorker.on('failed', (job, err) => {
  console.error(`[UCE Worker] Job ${job?.id} failed:`, err);
});
