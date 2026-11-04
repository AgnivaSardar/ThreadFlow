import sgMail from '@sendgrid/mail';
import { config } from '../config/env';

export class EmailService {
  private initialized = false;

  constructor() {
    if (config.sendgrid.apiKey) {
      sgMail.setApiKey(config.sendgrid.apiKey);
      this.initialized = true;
    }
  }

  /**
   * Dispatches a single transactional email via SendGrid.
   * If SendGrid fails (e.g. sender email not verified yet), logs warning gracefully without throwing.
   */
  public async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.initialized || !config.sendgrid.apiKey) {
      console.log(`[EMAIL SIMULATION] SendGrid not configured. Would send to: ${params.to}`);
      console.log(`[EMAIL SIMULATION] Subject: ${params.subject}`);
      return { success: true, messageId: 'simulated-id' };
    }

    try {
      const msg = {
        to: params.to,
        from: config.sendgrid.fromEmail,
        subject: params.subject,
        text: params.text,
        html: params.html,
      };

      const [response] = await sgMail.send(msg);
      console.log(`[SENDGRID SUCCESS] Email sent to ${params.to} (Status: ${response.statusCode})`);
      return { success: true, messageId: response.headers['x-message-id'] as string };
    } catch (err: any) {
      console.warn(`[SENDGRID NOTICE] Could not deliver email to ${params.to}:`, err.response?.body?.errors || err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sends password recovery instructions.
   */
  public async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${config.appOrigin}/login?resetToken=${resetToken}`;
    const subject = 'ThreadFlow — Password Reset Instructions';
    const text = `You requested a password reset for your ThreadFlow workspace account.\n\nUse this link to reset your credentials:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not make this request, please contact your administrator.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="margin-bottom: 20px;">
          <h2 style="color: #0C2D48; margin: 0; font-size: 22px;">ThreadFlow <span style="color: #f59e0b;">Intelligence</span></h2>
          <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Production Intelligence & Critical Path OS</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <h3 style="color: #0f172a; font-size: 16px;">Password Reset Request</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          You requested a password reset for your registered work email: <strong>${email}</strong>.
        </p>
        <div style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #f59e0b; color: #0f172a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            Reset Workspace Password →
          </a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
          This link will expire in 60 minutes for security purposes. If you did not request this, you can safely disregard this email.
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">© 2026 ThreadFlow Intelligence • Tiruppur Knitwear Operations</p>
      </div>
    `;

    const res = await this.sendEmail({ to: email, subject, text, html });
    return res.success;
  }

  /**
   * Sends schedule postponement / buyer alert notifications.
   */
  public async sendBuyerScheduleAlert(params: {
    buyerEmail: string;
    buyerName: string;
    poNumber: string;
    style: string;
    newExFactoryDate: string;
    reason: string;
  }): Promise<boolean> {
    const subject = `[ThreadFlow Notice] Schedule Update for PO #${params.poNumber}`;
    const text = `Dear ${params.buyerName},\n\nThe Ex-Factory schedule for PO #${params.poNumber} (${params.style}) has been adjusted to ${params.newExFactoryDate}.\nReason: ${params.reason}.\n\nPlease access your Buyer Portal to review updated milestone projections.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0C2D48; margin: 0; font-size: 20px;">ThreadFlow Sourcing Notice</h2>
        <p style="color: #334155; font-size: 14px; margin-top: 16px;">Dear ${params.buyerName},</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">
          The manufacturing critical path for purchase order <strong>#${params.poNumber}</strong> (<em>${params.style}</em>) has been updated:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tr>
            <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Revised Ex-Factory Date:</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #0C2D48;">${params.newExFactoryDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold;">Operational Reason:</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${params.reason}</td>
          </tr>
        </table>
        <div style="margin: 20px 0;">
          <a href="${config.appOrigin}/buyer-portal" style="background-color: #0C2D48; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: bold; display: inline-block;">
            Access Buyer Portal →
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 11px;">© 2026 ThreadFlow Intelligence • Tiruppur Knitwear Operations</p>
      </div>
    `;

    const res = await this.sendEmail({ to: params.buyerEmail, subject, text, html });
    return res.success;
  }
}

export const emailService = new EmailService();
