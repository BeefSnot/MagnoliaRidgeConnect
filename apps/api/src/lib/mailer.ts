import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? false,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

export async function sendRegistrationEmails(payload: {
  fullName: string;
  email: string;
  unitNumber: string;
  isAutoApproved: boolean;
}) {
  const transporter = getTransporter();
  if (!transporter) return;

  const { fullName, email, unitNumber, isAutoApproved } = payload;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: isAutoApproved
      ? "Welcome to Magnolia Ridge Connect"
      : "Registration Received - Magnolia Ridge Connect",
    text: isAutoApproved
      ? `Hi ${fullName}, your account is active and you can sign in now.`
      : `Hi ${fullName}, your registration for unit ${unitNumber} is pending manager approval.`
  });

  if (env.ADMIN_NOTIFICATION_EMAIL) {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: env.ADMIN_NOTIFICATION_EMAIL,
      subject: "New Magnolia Ridge registration pending approval",
      text: `${fullName} (${email}) from unit ${unitNumber} created an account and is awaiting approval.`
    });
  }
}
