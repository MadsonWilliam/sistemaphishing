// Configuração SMTP já com a senha em claro (decifrada em memória só na hora de enviar).
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true = TLS implícito (porta 465)
  username: string;
  password: string;
}

export interface SendMailInput {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  // Cabeçalhos extras (ex.: List-Unsubscribe, X-Campaign) — usados a partir da Sprint 2.
  headers?: Record<string, string>;
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}
