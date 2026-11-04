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
   * Sends 6-digit OTP email for password reset.
   */
  public async sendPasswordResetOtp(email: string, otpCode: string): Promise<boolean> {
    const subject = `ThreadFlow Verification Code: ${otpCode}`;
    const text = `Your ThreadFlow password reset verification code is: ${otpCode}\n\nThis OTP is valid for 10 minutes.\n\nNOTE: If you don't see this email in your inbox, please check your Spam/Junk folder.\n\nIf you did not request this, please contact your administrator immediately.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
        <div style="margin-bottom: 24px;">
          <h2 style="color: #0C2D48; margin: 0; font-size: 22px; font-weight: 800;">ThreadFlow <span style="color: #f59e0b;">Intelligence</span></h2>
          <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Production Intelligence & Critical Path OS</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <h3 style="color: #0f172a; font-size: 16px; font-weight: 700; margin-bottom: 8px;">Password Reset Verification Code</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">
          You requested to reset your password for: <strong>${email}</strong>. Use the 6-digit One-Time Password (OTP) below:
        </p>
        
        <div style="margin: 28px 0; text-align: center;">
          <div style="display: inline-block; background-color: #0C2D48; color: #ffffff; letter-spacing: 8px; font-size: 32px; font-weight: 900; font-family: monospace; padding: 14px 28px; border-radius: 12px; border: 2px solid #f59e0b; box-shadow: 0 4px 12px rgba(12, 45, 72, 0.15);">
            ${otpCode}
          </div>
          <div style="color: #64748b; font-size: 12px; margin-top: 8px; font-weight: 500;">Valid for 10 minutes</div>
        </div>

        <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; margin: 20px 0;">
          <p style="color: #92400e; font-size: 12px; margin: 0; font-weight: 600;">
            ⚠️ Notice: If you do not see this email in your main inbox, please be sure to check your <u>Spam or Junk folder</u>.
          </p>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
          If you did not request this password reset, your account credentials may be compromised. Please contact your administrator immediately.
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
