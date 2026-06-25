import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { to, subject, html, smtpSettings, attachments } = await req.json();

    if (!smtpSettings || !smtpSettings.host) {
      return NextResponse.json({ error: 'SMTP settings not configured' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: Number(smtpSettings.port),
      secure: smtpSettings.port === '465', // true for 465, false for other ports
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.pass,
      },
    });

    const mailOptions: any = {
      from: `"${smtpSettings.fromName || 'Reservation System'}" <${smtpSettings.user}>`,
      to,
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
        encoding: 'base64'
      }));
    }

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Email Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
