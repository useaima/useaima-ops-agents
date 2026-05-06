import { EmailMessage } from "cloudflare:email";

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export class EmailConnector {
  /**
   * Sends an email via Cloudflare Workers Email bindings.
   * Make sure the SEB (Send Email Binding) is configured in wrangler.toml as 'EMAIL_SENDER'.
   */
  async send(env: any, options: EmailOptions): Promise<void> {
    if (!env.EMAIL_SENDER) {
      console.warn("EMAIL_SENDER binding not found. Skipping email send.");
      return;
    }

    const fromAddress = options.from || "amukabanealvins@useaima.com";
    
    try {
      const message = new EmailMessage(
        fromAddress,
        options.to,
        options.subject,
        options.body
      );
      
      await env.EMAIL_SENDER.send(message);
      console.log(`Successfully sent email to ${options.to}`);
    } catch (error) {
      console.error("Failed to send email:", error);
      throw error;
    }
  }
}
