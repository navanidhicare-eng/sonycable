import { Capacitor } from '@capacitor/core';
import { Sms } from '@byteowls/capacitor-sms';

export interface SendAutoSmsOptions {
  phoneNumber: string;
  message: string;
}

/**
 * Automatically sends SMS in the background without user prompt when running inside native Android APK.
 * Fallbacks gracefully if running in a web browser.
 */
export async function sendAutoSms({ phoneNumber, message }: SendAutoSmsOptions): Promise<boolean> {
  if (!phoneNumber || !message) return false;

  // Clean phone number (keep digits only)
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "").slice(-10);
  if (cleanPhone.length !== 10) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      await Sms.send({
        numbers: [cleanPhone],
        text: message,
      });
      console.log(`[AutoSMS] Successfully sent native SMS to ${cleanPhone}`);
      return true;
    } catch (err) {
      console.error("[AutoSMS] Failed to send native SMS:", err);
      return false;
    }
  } else {
    console.log("[AutoSMS] Running in Web Browser. Native auto-SMS skipped.");
    return false;
  }
}
