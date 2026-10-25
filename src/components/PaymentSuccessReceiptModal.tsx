"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, MessageSquare, Copy, Check, Send, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { sendAutoSms } from "@/lib/autoSms";

export interface ReceiptData {
  businessName?: string;
  customerName: string;
  customerId?: string;
  customerDocId?: string;
  mobile: string;
  totalBill?: number;
  paidAmount: number;
  remainingBalance: number;
  date: Date | string;
  collectedByName?: string;
  supportNumber?: string;
  customMessage?: string;
  ledgerUrl?: string;
}

export interface RechargeReceiptData {
  businessName?: string;
  customerName: string;
  customerId?: string;
  customerDocId?: string;
  mobile: string;
  oldDue: number;
  rechargeAmount: number;
  newDue: number;
  date: Date | string;
  packageName?: string;
  months?: number;
  newExpiryDate?: Date | string;
  collectedByName?: string;
  supportNumber?: string;
  customMessage?: string;
  ledgerUrl?: string;
  isExtraDue?: boolean;
  serviceReason?: string;
}

interface PaymentSuccessReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData?: ReceiptData | null;
  rechargeData?: RechargeReceiptData | null;
  type?: "payment" | "recharge";
}

export const getPublicBaseUrl = (): string => {
  if (typeof window === "undefined") return "";

  // 1. If explicit app URL configured in localStorage or env
  const savedUrl = typeof localStorage !== "undefined" ? localStorage.getItem("app_base_url") : null;
  if (savedUrl && savedUrl.trim()) return savedUrl.trim().replace(/\/$/, "");

  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/$/, "");

  let origin = window.location.origin;

  // 2. If origin is local LAN IP (e.g. 192.168.x.x), localhost, or Capacitor native view,
  // use the public web domain so customer links work over mobile data anywhere!
  if (
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("192.168.") ||
    origin.includes("capacitor://")
  ) {
    return "https://sony.navanidhi.org";
  }

  return origin;
};

export const generateReceiptText = (data: ReceiptData): string => {
  const businessName = "Sony Cable";
  const formattedDate = typeof data.date === "string"
    ? data.date
    : data.date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const customerIdLine = data.customerId ? `\nకస్టమర్ ID: ${data.customerId}` : "";
  const totalBillText = data.totalBill !== undefined ? `\nమొత్తం బిల్లు: ₹${data.totalBill.toLocaleString("en-IN")}` : "";
  const supportNum = "9010737882";

  // పాస్‌బుక్ లెడ్జర్ లింక్ జనరేషన్
  const docId = data.customerDocId || data.customerId;
  let ledgerLink = data.ledgerUrl || "";
  if (!ledgerLink && docId) {
    const baseUrl = getPublicBaseUrl();
    if (baseUrl) {
      ledgerLink = `${baseUrl}/passbook?id=${docId}`;
    }
  }
  const ledgerLine = ledgerLink ? `\n\nపాస్‌బుక్ లెడ్జర్ లింక్:\n${ledgerLink}` : "";

  // బ్యాలెన్స్ ఫార్మాటింగ్ లాజిక్
  const balanceVal = Number(data.remainingBalance || 0);
  const formattedBalance = balanceVal < 0
    ? `-₹${Math.abs(balanceVal).toLocaleString("en-IN")}`
    : `₹${balanceVal.toLocaleString("en-IN")}`;

  const customMsg = data.customMessage !== undefined
    ? data.customMessage.trim()
    : (typeof window !== "undefined" ? (localStorage.getItem("receipt_custom_message") || "").trim() : "");
  const customMessageLine = customMsg ? `\n\n${customMsg}` : "";

  return `
${businessName}
Payment Receipt

కస్టమర్ పేరు: ${data.customerName}${customerIdLine}${totalBillText}
చెల్లించిన మొత్తం: ₹${data.paidAmount.toLocaleString("en-IN")}
మిగిలిన బాకీ: ${formattedBalance}
తేదీ: ${formattedDate}
వసూలు చేసినవారు: ${data.collectedByName || "Staff"}

Sony Cable సేవలను పొందుతున్నందుకు ధన్యవాదాలు!
హెల్ప్లైన్ నెంబర్: ${supportNum}${ledgerLine}${customMessageLine}`;
};

export const generateExtraDueReceiptText = (data: RechargeReceiptData): string => {
  const businessName = "Sony Cable";
  const formattedDate = typeof data.date === "string"
    ? data.date
    : data.date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const customerIdLine = data.customerId ? `\nకస్టమర్ ID: ${data.customerId}` : "";

  let serviceReason = data.serviceReason || data.packageName || "సర్వీస్ ఛార్జ్";
  if (serviceReason.startsWith("Service Charge - ")) {
    serviceReason = serviceReason.replace("Service Charge - ", "");
  }

  const supportNum = "9010737882";

  // పాస్‌బుక్ లెడ్జర్ లింక్ జనరేషన్
  const docId = data.customerDocId || data.customerId;
  let ledgerLink = data.ledgerUrl || "";
  if (!ledgerLink && docId) {
    const baseUrl = getPublicBaseUrl();
    if (baseUrl) {
      ledgerLink = `${baseUrl}/passbook?id=${docId}`;
    }
  }
  const ledgerLine = ledgerLink ? `\n\nపాస్‌బుక్ లెడ్జర్ లింక్:\n${ledgerLink}` : "";

  // బ్యాలెన్స్ ఫార్మాటింగ్ లాజిక్
  const oldDueVal = Number(data.oldDue || 0);
  const formattedOldDue = oldDueVal < 0
    ? `-₹${Math.abs(oldDueVal).toLocaleString("en-IN")}`
    : `₹${oldDueVal.toLocaleString("en-IN")}`;

  const newDueVal = Number(data.newDue || 0);
  const formattedNewDue = newDueVal < 0
    ? `-₹${Math.abs(newDueVal).toLocaleString("en-IN")}`
    : `₹${newDueVal.toLocaleString("en-IN")}`;

  const customMsg = data.customMessage !== undefined
    ? data.customMessage.trim()
    : (typeof window !== "undefined" ? (localStorage.getItem("receipt_custom_message") || "").trim() : "");
  const customMessageLine = customMsg ? `\n\n${customMsg}` : "";

  return `---------------------------------
*${businessName}*
*సర్వీస్ ఛార్జ్ వివరాలు (Service Charge Added)*
---------------------------------
కస్టమర్ పేరు: ${data.customerName}${customerIdLine}
సేవ / వివరాలు: ${serviceReason}
తేదీ: ${formattedDate}
పాత బాకీ: ${formattedOldDue}
సర్వీస్ ఛార్జ్: ₹${data.rechargeAmount.toLocaleString("en-IN")}
మొత్తం బాకీ: ${formattedNewDue}

Sony Cable Network సేవలను పొందుతున్నందుకు ధన్యవాదాలు!
హెల్ప్‌లైన్ నెంబర్: ${supportNum}${ledgerLine}${customMessageLine}`;
};

export const generateRechargeReceiptText = (data: RechargeReceiptData): string => {
  const isExtraDue = Boolean(data.isExtraDue) || (data.packageName ? /service charge|extra due/i.test(data.packageName) : false);
  if (isExtraDue) {
    return generateExtraDueReceiptText(data);
  }

  const businessName = "Sony Cable";
  const formattedDate = typeof data.date === "string"
    ? data.date
    : data.date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const customerIdLine = data.customerId ? `\nకస్టమర్ ID: ${data.customerId}` : "";
  const packageInfo = data.packageName ? `\nప్లాన్: ${data.packageName}` : "";
  const monthsLine = data.months ? `\nరీఛార్జ్ చేసిన నెలలు: ${data.months} నెల(లు)` : "";
  const expiryLine = data.newExpiryDate 
    ? `\nకొత్త గడువు తేదీ: ${typeof data.newExpiryDate === 'string' ? data.newExpiryDate : data.newExpiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` 
    : "";
  const supportNum = "9010737882";

  // పాస్‌బుక్ లెడ్జర్ లింక్ జనరేషన్
  const docId = data.customerDocId || data.customerId;
  let ledgerLink = data.ledgerUrl || "";
  if (!ledgerLink && docId) {
    const baseUrl = getPublicBaseUrl();
    if (baseUrl) {
      ledgerLink = `${baseUrl}/passbook?id=${docId}`;
    }
  }
  const ledgerLine = ledgerLink ? `\n\nపాస్‌బుక్ లెడ్జర్ లింక్:\n${ledgerLink}` : "";

  // బ్యాలెన్స్ ఫార్మాటింగ్ లాజిక్
  const oldDueVal = Number(data.oldDue || 0);
  const formattedOldDue = oldDueVal < 0
    ? `-₹${Math.abs(oldDueVal).toLocaleString("en-IN")}`
    : `₹${oldDueVal.toLocaleString("en-IN")}`;

  const newDueVal = Number(data.newDue || 0);
  const formattedNewDue = newDueVal < 0
    ? `-₹${Math.abs(newDueVal).toLocaleString("en-IN")}`
    : `₹${newDueVal.toLocaleString("en-IN")}`;

  const customMsg = data.customMessage !== undefined
    ? data.customMessage.trim()
    : (typeof window !== "undefined" ? (localStorage.getItem("receipt_custom_message") || "").trim() : "");
  const customMessageLine = customMsg ? `\n\n${customMsg}` : "";

  return `
${businessName}
Recharge / Renewal Successful

కస్టమర్ పేరు: ${data.customerName}${customerIdLine}${packageInfo}${monthsLine}${expiryLine}
రీఛార్జ్ చేసిన తేదీ: ${formattedDate}
పాత బాకీ: ${formattedOldDue}
రీఛార్జ్ మొత్తం: ₹${data.rechargeAmount.toLocaleString("en-IN")}
మొత్తం బాకీ: ${formattedNewDue}

Sony Cable Network సేవలను పొందుతున్నందుకు ధన్యవాదాలు!
హెల్ప్లైన్ నెంబర్: ${supportNum}${ledgerLine}${customMessageLine}`;
};

export const openWhatsAppReceipt = (mobile: string, text: string) => {
  const phone = (mobile || "").replace(/[^0-9]/g, "");
  const waPhone = phone.length === 10 ? "91" + phone : phone;
  const encodedText = encodeURIComponent(text);
  const url = `https://wa.me/${waPhone}?text=${encodedText}`;
  window.open(url, "_blank");
};

export const openSmsReceipt = (mobile: string, text: string) => {
  const phone = (mobile || "").replace(/[^0-9]/g, "");
  const smsPhone = phone.length === 10 ? "+91" + phone : phone;
  const encodedText = encodeURIComponent(text);
  const url = `sms:${smsPhone}?body=${encodedText}`;
  window.open(url, "_self");
};

export default function PaymentSuccessReceiptModal({
  isOpen,
  onClose,
  receiptData,
  rechargeData,
  type = "payment",
}: PaymentSuccessReceiptModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [liveCustomMsg, setLiveCustomMsg] = useState<string>("");
  const [autoSmsSent, setAutoSmsSent] = useState<boolean>(false);

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, "settings", "receipt_config"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const msg = (data.enabled !== false && data.customMessage) ? String(data.customMessage) : "";
          setLiveCustomMsg(msg);
          if (typeof window !== "undefined") {
            localStorage.setItem("receipt_custom_message", msg);
          }
        }
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const isRecharge = type === "recharge" || Boolean(rechargeData);
  const isExtraDue = Boolean(rechargeData?.isExtraDue) || (rechargeData?.packageName ? /service charge|extra due/i.test(rechargeData.packageName) : false);
  const activeData = isRecharge ? rechargeData : receiptData;

  const receiptText = isRecharge && rechargeData
    ? generateRechargeReceiptText({
      ...rechargeData,
      customMessage: rechargeData.customMessage ?? liveCustomMsg,
    })
    : receiptData
      ? generateReceiptText({
        ...receiptData,
        customMessage: receiptData.customMessage ?? liveCustomMsg,
      })
      : "";

  const customerName = activeData?.customerName || "";
  const mobile = activeData?.mobile || "";

  useEffect(() => {
    if (isOpen && mobile && receiptText) {
      sendAutoSms({ phoneNumber: mobile, message: receiptText })
        .then((success) => {
          if (success) {
            setAutoSmsSent(true);
            toast({
              title: "SMS Sent Successfully",
              description: `Direct SMS auto-sent to customer mobile: ${mobile}`,
            });
          }
        })
        .catch((err) => {
          console.warn("[AutoSMS] Error sending auto SMS:", err);
        });
    } else {
      setAutoSmsSent(false);
    }
  }, [isOpen, mobile, receiptText, toast]);

  if (!activeData) return null;

  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    toast({
      title: "Receipt Copied",
      description: "Receipt text copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    openWhatsAppReceipt(mobile, receiptText);
    toast({
      title: "Opening WhatsApp",
      description: `Redirecting to WhatsApp chat for ${customerName}...`,
    });
  };

  const handleManualSMS = () => {
    sendAutoSms({ phoneNumber: mobile, message: receiptText })
      .then((success) => {
        if (success) {
          setAutoSmsSent(true);
          toast({
            title: "SMS Sent",
            description: `Direct background SMS sent to ${mobile}`,
          });
        } else {
          openSmsReceipt(mobile, receiptText);
        }
      })
      .catch((err) => {
        console.warn("[AutoSMS] Manual SMS error fallback:", err);
        openSmsReceipt(mobile, receiptText);
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[460px] p-6">
        <DialogHeader className="text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {isExtraDue
              ? "Service Charge Added!"
              : isRecharge
                ? "Recharge Successful!"
                : "Payment Successful!"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {isExtraDue && rechargeData ? (
              <>
                Service charge of <strong className="text-foreground">₹{rechargeData.rechargeAmount.toLocaleString("en-IN")}</strong> added for {customerName}.
              </>
            ) : isRecharge && rechargeData ? (
              <>
                Recharge of <strong className="text-foreground">₹{rechargeData.rechargeAmount.toLocaleString("en-IN")}</strong> completed for {customerName}.
              </>
            ) : receiptData ? (
              <>
                Payment of <strong className="text-foreground">₹{receiptData.paidAmount.toLocaleString("en-IN")}</strong> recorded for {customerName}.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Auto SMS Status Banner */}
        {autoSmsSent ? (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <Send className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>మొబైల్‌కి SMS ఆటోమేటిక్‌గా పంపబడింది ({mobile})</span>
          </div>
        ) : null}

        {/* Receipt Text Preview Card */}
        <div className="my-2 p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs leading-relaxed relative border border-slate-800">
          <button
            onClick={handleCopyReceipt}
            className="absolute top-2.5 right-2.5 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Copy Receipt Text"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight">
            {receiptText}
          </pre>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 mt-2">
          <Button
            onClick={handleWhatsApp}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-sm shadow-md flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            Send WhatsApp Receipt
          </Button>

          <Button
            onClick={handleManualSMS}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 text-sm shadow-md flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            Resend Direct SMS
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-10 font-semibold text-slate-700 dark:text-slate-200"
          >
            {isExtraDue ? "Done" : isRecharge ? "Done / Next Recharge" : "Done / Next Collection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
