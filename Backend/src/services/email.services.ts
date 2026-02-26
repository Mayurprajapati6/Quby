import nodemailer, { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import path from 'path';
import fs from 'fs';
import { emailQueue } from '../config/bullmq';
import { serverConfig } from '../config';
import logger from '../config/logger.config';
import type { EmailJobType } from '../config/bullmq';

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

const TEMPLATES_DIR = path.join(process.cwd(), 'src', 'templates', 'emails');

function getTemplate(name: string): HandlebarsTemplateDelegate {
    if (templateCache.has(name)) {
        return templateCache.get(name)!;
    }

    const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Email template not found: ${name}.hbs`);
    }

    const source   = fs.readFileSync(filePath, 'utf-8');
    const compiled = Handlebars.compile(source);
    templateCache.set(name, compiled);
    return compiled;
}

Handlebars.registerHelper('formatCurrency', (amount: number) => {
    return `₹${(amount / 100).toFixed(2)}`;
});

Handlebars.registerHelper('formatDate', (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
});

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (_transporter) return _transporter;

    _transporter = nodemailer.createTransport({
        host:   'smtp.gmail.com',
        port:   587,
        secure: false,         
        auth: {
            user: serverConfig.MAIL_USER,
            pass: serverConfig.MAIL_PASS,
        },
    });

    return _transporter;
}

export interface SendEmailOptions {
  to:        string;
  type:      EmailJobType;
  data:      Record<string, unknown>;
  delay?:    number;        
  priority?: number;
}

export async function queueEmail(options: SendEmailOptions): Promise<void> {
  await emailQueue.add(
    options.type,
    { to: options.to, type: options.type, data: options.data },
    {
      delay:    options.delay,
      priority: options.priority ?? 5,
    }
  );
  logger.info(`[Email] Queued '${options.type}' to ${options.to}`);
}

export async function sendEmail(
  to:   string,
  type: EmailJobType,
  data: Record<string, unknown>
): Promise<void> {
  const transporter = getTransporter();

  const config = EMAIL_CONFIG[type];
  if (!config) throw new Error(`No email config for type: ${type}`);

  const template = getTemplate(config.template);
  const html     = template({ ...data, appName: process.env.APP_NAME ?? 'Saloon App' });

  await transporter.sendMail({
    from:    `"${process.env.APP_NAME ?? 'Saloon App'}" <${serverConfig.MAIL_USER}>`,
    to,
    subject: config.subject(data),
    html,
  });

  logger.info(`[Email] Sent '${type}' to ${to}`);
}

const EMAIL_CONFIG: Record<
  EmailJobType,
  { template: string; subject: (data: Record<string, unknown>) => string }
> = {
  'booking-confirmation': {
    template: 'booking-confirmation',
    subject:  (d) => `Booking Confirmed – ${d.businessName}`,
  },
  'staff-invitation': {
    template: 'staff-invitation',
    subject:  (d) => `You've been added to ${d.businessName}`,
  },
  'password-reset': {
    template: 'password-reset',
    subject:  () => 'Reset your password',
  },
  'refund-confirmation': {
    template: 'refund-confirmation',
    subject:  (d) => `Refund processed – ${d.bookingNumber}`,
  },
  'review-reminder': {
    template: 'review-reminder',
    subject:  (d) => `How was your visit to ${d.businessName}?`,
  },
  'leave-request-owner': {
    template: 'leave-request-owner',
    subject:  (d) => `Leave request from ${d.staffName}`,
  },
  'leave-approved-staff': {
    template: 'leave-approved-staff',
    subject:  () => 'Your leave request has been approved',
  },
  'leave-rejected-staff': {
    template: 'leave-rejected-staff',
    subject:  () => 'Your leave request has been rejected',
  },
  'business-approved': {
    template: 'business-approved',
    subject:  (d) => `🎉 ${d.businessName} is now live!`,
  },
  'business-rejected': {
    template: 'business-rejected',
    subject:  (d) => `Business verification update – ${d.businessName}`,
  },
};