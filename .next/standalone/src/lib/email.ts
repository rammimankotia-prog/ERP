import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

interface SendCredentialsParams {
  to: string;
  name: string;
  employeeId: string;
  password: string;
  role: string;
}

export async function sendEmployeeCredentials({
  to,
  name,
  employeeId,
  password,
  role,
}: SendCredentialsParams): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Read SMTP settings from environment or global config
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const fromName = process.env.SMTP_FROM_NAME || 'Godwin Hotels ERP Admin';

    // Log the onboarding event for audit records
    const auditDir = path.join(process.cwd(), 'data');
    const auditFile = path.join(auditDir, 'audit_credentials.json');
    try {
      if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
      const logs = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, 'utf-8')) : [];
      logs.push({
        timestamp: new Date().toISOString(),
        to,
        employeeId,
        name,
        role,
        sent: !!(user && pass),
      });
      fs.writeFileSync(auditFile, JSON.stringify(logs.slice(-200), null, 2));
    } catch {}

    // If SMTP credentials not provided in environment, simulate successful dispatch in dev
    if (!user || !pass) {
      console.log(`[SMTP SIMULATION] Onboarding credentials for ${name} (${employeeId}):`);
      console.log(`Email: ${to} | Password: ${password} | Portal: https://grandgodwin.com/login`);
      return {
        success: true,
        message: 'Credentials generated and logged. (SMTP credentials not configured in .env; email simulated)',
      };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://grandgodwin.com/login';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #f59e0b;">
            HOTEL GRAND GODWIN &amp; GODWIN DELUXE
          </h1>
          <p style="margin: 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
            Official ERP &amp; Staff Terminal Onboarding
          </p>
        </div>

        <div style="padding: 28px 24px;">
          <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">
            Welcome to the Team, ${name}!
          </h2>
          <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
            Your employee profile and official portal credentials have been provisioned in the Godwin Enterprise ERP System. You can now access your attendance logs, duty roster, and submit leave requests directly from any device.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
            <div style="margin-bottom: 10px; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Staff ID:</span>
              <strong style="color: #0f172a; margin-left: 8px; font-family: monospace; font-size: 14px;">${employeeId}</strong>
            </div>
            <div style="margin-bottom: 10px; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Login Portal:</span>
              <a href="${portalUrl}" style="color: #2563eb; margin-left: 8px; text-decoration: none; font-weight: 600;">${portalUrl}</a>
            </div>
            <div style="margin-bottom: 10px; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Username / Email:</span>
              <strong style="color: #0f172a; margin-left: 8px;">${to}</strong>
            </div>
            <div style="font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Assigned Role:</span>
              <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 999px; margin-left: 8px; font-size: 12px; font-weight: 700;">${role}</span>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Temporary Password:</span>
              <span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 15px; font-weight: 800; margin-left: 8px; letter-spacing: 0.05em;">${password}</span>
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
              Access Godwin ERP Portal ➔
            </a>
          </div>

          <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
            🔒 Security Notice: Please do not share these credentials with anyone. For assistance, contact Hotel Management at mail@godwinhotels.com.
          </p>
        </div>

        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Hotel Grand Godwin &amp; Hotel Godwin Deluxe • Arakashan Road, Pahar Ganj, New Delhi - 110055
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject: `Welcome to Godwin Hotels - Your ERP Credentials (${employeeId})`,
      html,
    });

    return { success: true, message: `Credentials successfully dispatched to ${to}` };
  } catch (error: any) {
    console.error('Failed to send credentials email:', error);
    return { success: false, message: 'Failed to send credentials email', error: error.message };
  }
}

interface SendLeaveApprovalParams {
  to: string;
  name: string;
  employeeId: string;
  fromDate: string;
  toDate: string;
  leaveType?: string;
  approverNote?: string;
}

export async function sendLeaveApprovalEmail({
  to,
  name,
  employeeId,
  fromDate,
  toDate,
  leaveType = 'Approved Leave',
  approverNote = 'Approved by Management',
}: SendLeaveApprovalParams): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || '465');
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const fromName = process.env.SMTP_FROM_NAME || 'Godwin Hotels HR Administration';

    if (!user || !pass) {
      console.log(`[SMTP SIMULATION] Leave Approval Notification for ${name} (${employeeId}):`);
      console.log(`To: ${to} | Dates: ${fromDate} to ${toDate} | Type: ${leaveType}`);
      return {
        success: true,
        message: 'Leave approval email simulated (SMTP credentials not configured in .env)',
      };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #fde68a;">
            HOTEL GRAND GODWIN &amp; GODWIN DELUXE
          </h1>
          <p style="margin: 0; font-size: 13px; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.05em;">
            HR Leave Approval Notice
          </p>
        </div>

        <div style="padding: 28px 24px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 28px;">
              ✓
            </div>
            <h2 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
              Leave Request Approved
            </h2>
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              Dear <strong>${name}</strong>, your leave request has been reviewed and officially approved.
            </p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Staff ID:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right; font-family: monospace;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                <td style="padding: 6px 0; color: #059669; font-weight: 700; text-align: right;">${leaveType}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">From Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right;">${fromDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">To Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right;">${toDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Approver Remarks:</td>
                <td style="padding: 6px 0; color: #0f172a; font-style: italic; text-align: right;">${approverNote}</td>
              </tr>
            </table>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #065f46; line-height: 1.4;">
            🔒 <strong>Duty Roster Notice:</strong> Your duty roster and Security Gate Kiosk records have been automatically updated with official <strong>Approved Leave (Non-Amended)</strong> status for the specified period.
          </div>

          <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
            For queries or extensions, please contact the HR Management Department at mail@godwinhotels.com.
          </p>
        </div>

        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Hotel Grand Godwin &amp; Hotel Godwin Deluxe • Arakashan Road, Pahar Ganj, New Delhi - 110055
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
      subject: `✅ Leave Request Approved (${fromDate} to ${toDate}) - Godwin Hotels`,
      html,
    });

    return { success: true, message: `Leave approval notice dispatched to ${to}` };
  } catch (error: any) {
    console.error('Failed to send leave approval email:', error);
    return { success: false, message: 'Failed to send leave approval email', error: error.message };
  }
}

