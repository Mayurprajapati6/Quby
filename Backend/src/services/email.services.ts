import nodemailer, { Transporter } from "nodemailer";
import Handlebars from "handlebars";
import path from "path";
import fs from "fs";
import { emailQueue } from "../config/bullmq";
import { serverConfig } from "../config";
import logger from "../config/logger.config";
import type { EmailJobType } from "../config/bullmq";

const templateCache = new Map<string, HandlebarsTemplateDelegate>();
function resolveTemplatesDir(): string {
  const candidates = [
    path.join(process.cwd(), "src", "templates", "emails"),
    path.join(process.cwd(), "Backend", "src", "templates", "emails"),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  return found ?? candidates[0];
}
const TEMPLATES_DIR = resolveTemplatesDir();

function getTemplate(name: string): HandlebarsTemplateDelegate {
  if (templateCache.has(name)) return templateCache.get(name)!;
  const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
  if (!fs.existsSync(filePath)) throw new Error(`Email template not found: ${name}.hbs`);
  const compiled = Handlebars.compile(fs.readFileSync(filePath, "utf-8"));
  templateCache.set(name, compiled);
  return compiled;
}

Handlebars.registerHelper("formatCurrency", (paise: number) =>
  `₹${(paise / 100).toFixed(2)}`,
);
Handlebars.registerHelper("formatDate", (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
);
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("or", (a: unknown, b: unknown) => a || b);

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  if (!serverConfig.MAIL_USER || !serverConfig.MAIL_PASS) {
    throw new Error("Missing MAIL_USER or MAIL_PASS environment variable for SMTP email delivery.");
  }
  _transporter = nodemailer.createTransport({
    host:   "smtp.gmail.com",
    port:   587,
    secure: false,      
    auth: {
      user: serverConfig.MAIL_USER,
      pass: serverConfig.MAIL_PASS,
    },
  });
  return _transporter;
}

type EmailConfig = {
  template: string;
  subject:  (data: Record<string, unknown>) => string;
};

const EMAIL_CONFIG: Record<EmailJobType, EmailConfig> = {

  "staff-invitation": {
    template: "staff-invitation",
    subject:  (d: Record<string, unknown>) => `You've been invited to join ${d.businessName} on Quby`,
  },

  "staff-reinvitation": {
    template: "staff-reinvitation",
    subject:  (d: Record<string, unknown>) => `Reminder: Complete your Quby setup at ${d.businessName}`,
  },

  "password-reset": {
    template: "password-reset",
    subject:  () => "Reset your Quby password",
  },

  "change-password-confirmation": {
    template: "change-password-confirmation",
    subject: () => "Your Quby password was changed"
  },

  "booking-confirmation": {
    template: "booking-confirmation",
    subject:  (d: Record<string, unknown>) => `Booking Confirmed at ${d.businessName} 🎉`,
  },

  "booking-cancelled": {
    template: "booking-cancelled",
    subject:  (d: Record<string, unknown>) => `Your booking at ${d.businessName} has been cancelled`,
  },

  "booking-cancelled-by-business": {
    template: "booking-cancelled-by-business",
    subject:  (d: Record<string, unknown>) => `Your booking at ${d.businessName} has been cancelled`,
  },

  "refund-confirmation": {
    template: "refund-confirmation",
    subject:  (d: Record<string, unknown>) => `Refund processed – Booking #${d.bookingNumber}`,
  },

  "leave-request-owner": {
    template: "leave-request-owner",
    subject:  (d: Record<string, unknown>) => `Leave request from ${d.staffName} – ${d.businessName}`,
  },

  "leave-approved-staff": {
    template: "leave-approved-staff",
    subject:  () => "Your leave request has been approved ✅",
  },

  "leave-rejected-staff": {
    template: "leave-rejected-staff",
    subject:  () => "Your leave request was not approved",
  },

  "business-holiday": {
    template: "business-holiday",
    subject:  (d: Record<string, unknown>) => `Holiday notice: ${d.holidayName} – ${d.businessName}`,
  },

  "booking-reminder": {
    template: "booking-reminder",
    subject:  (d: Record<string, unknown>) => `Reminder: Your appointment at ${d.businessName} in ${d.timeLabel}`,
  },

  "account-deleted": {
    template: "account-deleted",
    subject:  () => "Your Quby account has been deleted",
  },

  "service-completed": {
    template: "service-completed",
    subject:  (d: Record<string, unknown>) => `Your appointment at ${d.businessName} is complete`,
  },
};
export interface QueueEmailOptions {
  to:        string;
  type:      EmailJobType;
  data:      Record<string, unknown>;
  delay?:    number;
  priority?: number;
}

export async function queueEmail(opts: QueueEmailOptions): Promise<void> {
  await emailQueue.add(
    opts.type,
    { to: opts.to, type: opts.type, data: opts.data },
    { delay: opts.delay, priority: opts.priority ?? 5 },
  );
  logger.info(`[Email] Queued '${opts.type}' → ${opts.to}`);
}

export async function sendEmail(
  to:   string,
  type: EmailJobType,
  data: Record<string, unknown>,
): Promise<void> {
  const config = EMAIL_CONFIG[type];
  if (!config) throw new Error(`No email config for type: ${type}`);

  const template = getTemplate(config.template);
  const html     = template({ ...data, appName: serverConfig.APP_NAME, logoUrl: serverConfig.APP_LOGO_URL });

  await getTransporter().sendMail({
    from:    `"${serverConfig.APP_NAME}" <${serverConfig.MAIL_USER}>`,
    to,
    subject: config.subject(data),
    html,
  });

  logger.info(`[Email] Sent '${type}' → ${to}`);
}

export async function processEmail(payload: {
  to:   string;
  type: EmailJobType;
  data: Record<string, unknown>;
}): Promise<void> {
  await sendEmail(payload.to, payload.type, payload.data);
}
