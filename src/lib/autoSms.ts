import { Capacitor } from '@capacitor/core';
import { SmsManager } from '@byteowls/capacitor-sms';

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

  // 1. Direct Native Android SmsManager Bridge (100% background without prompt)
  if (typeof window !== "undefined" && (window as any).AndroidSmsBridge) {
    try {
      (window as any).AndroidSmsBridge.sendDirectSms(cleanPhone, message);
      console.log(`[AutoSMS] Successfully sent native background SMS via SmsManager to ${cleanPhone}`);
      return true;
    } catch (err) {
      console.error("[AutoSMS] Native AndroidSmsBridge error:", err);
    }
  }

  // 2. Capacitor Plugin Fallback
  if (Capacitor.isNativePlatform()) {
    try {
      await SmsManager.send({
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
