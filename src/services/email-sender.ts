'use server';
/**
 * @fileOverview Server-side service to send real emails via SMTP (Gmail).
 */

import nodemailer from 'nodemailer';
import { SmtpConfig } from '@/app/lib/types';

interface SendEmailParams {
  config: SmtpConfig;
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends an email using Nodemailer and Gmail SMTP settings.
 * Requires a "Google App Password" if using Gmail.
 */
export async function sendRealEmail({ config, to, subject, body }: SendEmailParams) {
  if (!config.user || !config.pass) {
    throw new Error("Configuração de SMTP incompleta. Verifique seu Gmail e Senha de App.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${config.fromName || 'Fluxion Radar'}" <${config.user}>`,
      to,
      subject,
      html: body,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Nodemailer Error:", error);
    throw new Error(error.message || "Erro desconhecido ao enviar e-mail.");
  }
}
