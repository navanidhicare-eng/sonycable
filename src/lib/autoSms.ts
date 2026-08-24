import { Capacitor, registerPlugin } from '@capacitor/core';
import { SmsManager } from '@byteowls/capacitor-sms';

interface DirectSmsPluginInterface {
  sendDirectSms(options: { phoneNumber: string; message: string }): Promise<{ success: boolean }>;
}

const DirectSms = registerPlugin<DirectSmsPluginInterface>('DirectSms');

export interface SendAutoSmsOptions {
  phoneNumber: string;
  message: string;
}

/**
 * Automatically sends SMS in the background without user prompt when running inside native Android APK.
 * Fallbacks gracefully if running in a web browser.
 */
export async function sendAutoSms({ phoneNumber, message }: SendAutoSmsOptions): Promise<boolean> {
  try {
    if (!phoneNumber || !message) return false;

    // Clean phone number (keep digits only)
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, "").slice(-10);
    if (cleanPhone.length !== 10) return false;

    // 1. Try Native Capacitor Plugin DirectSms (100% direct background sending without prompt)
    if (Capacitor.isNativePlatform()) {
      try {
        await DirectSms.sendDirectSms({
          phoneNumber: cleanPhone,
          message: message,
        });
        console.log(`[AutoSMS] Successfully sent direct background SMS via DirectSms plugin to ${cleanPhone}`);
        return true;
      } catch (err) {
        console.warn("[AutoSMS] DirectSms plugin attempt failed or fallback needed:", err);
      }
    }

    // 2. Direct Native Android JavascriptBridge (as second background layer)
    if (typeof window !== "undefined" && (window as any).AndroidSmsBridge) {
      try {
        (window as any).AndroidSmsBridge.sendDirectSms(cleanPhone, message);
        console.log(`[AutoSMS] Successfully sent native background SMS via AndroidSmsBridge to ${cleanPhone}`);
        return true;
      } catch (err) {
        console.error("[AutoSMS] Native AndroidSmsBridge error:", err);
      }
    }

    // 3. Capacitor Plugin Fallback
    if (Capacitor.isNativePlatform()) {
      try {
        await SmsManager.send({
          numbers: [cleanPhone],
          text: message,
        });
        console.log(`[AutoSMS] Sent native SMS to ${cleanPhone}`);
        return true;
      } catch (err) {
        console.error("[AutoSMS] Failed to send native SMS:", err);
        return false;
      }
    } else {
      console.log("[AutoSMS] Running in Web Browser. Native auto-SMS skipped.");
      return false;
    }
  } catch (globalErr) {
    console.warn("[AutoSMS] AutoSMS execution error handled:", globalErr);
    return false;
  }
}
