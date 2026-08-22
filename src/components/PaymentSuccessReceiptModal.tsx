"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, MessageSquare, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ReceiptData {
  businessName?: string;
  customerName: string;
  customerId?: string;
  mobile: string;
  totalBill?: number;
  paidAmount: number;
  remainingBalance: number;
  date: Date | string;
  collectedByName?: string;
  supportNumber?: string;
}

export interface RechargeReceiptData {
  businessName?: string;
  customerName: string;
  customerId?: string;
  mobile: string;
  oldDue: number;
  rechargeAmount: number;
  newDue: number;
  date: Date | string;
  packageName?: string;
  months?: number;
  collectedByName?: string;
  supportNumber?: string;
}

interface PaymentSuccessReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData?: ReceiptData | null;
  rechargeData?: RechargeReceiptData | null;
  type?: "payment" | "recharge";
}

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

  return `---------------------------------
*${businessName}*
*చెల్లింపు రశీదు (Payment Receipt)*
---------------------------------
కస్టమర్ పేరు: ${data.customerName}${customerIdLine}${totalBillText}
చెల్లించిన మొత్తం: ₹${data.paidAmount.toLocaleString("en-IN")}
మిగిలిన బాకీ: ₹${data.remainingBalance.toLocaleString("en-IN")}
తేదీ: ${formattedDate}
వసూలు చేసినవారు: ${data.collectedByName || "Staff"}

Sony Cable సేవలను పొందుతున్నందుకు ధన్యవాదాలు!
హెల్ప్‌లైన్ నెంబర్: ${supportNum}
---------------------------------`;
};

export const generateRechargeReceiptText = (data: RechargeReceiptData): string => {
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
  const supportNum = "9010737882";

  return `---------------------------------
*${businessName}*
*రీఛార్జ్ సక్సెస్‌ఫుల్! (Recharge Successful)*
---------------------------------
కస్టమర్ పేరు: ${data.customerName}${customerIdLine}${packageInfo}
రీఛార్జ్ చేసిన తేదీ: ${formattedDate}
పాత బాకీ: ₹${data.oldDue.toLocaleString("en-IN")}
రీఛార్జ్ మొత్తం: ₹${data.rechargeAmount.toLocaleString("en-IN")}
కొత్త బాకీ: ₹${data.newDue.toLocaleString("en-IN")}
వసూలు చేసినవారు: ${data.collectedByName || "Staff"}

Sony Cable సేవలను పొందుతున్నందుకు ధన్యవాదాలు!
హెల్ప్‌లైన్ నెంబర్: ${supportNum}
---------------------------------`;
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

  const isRecharge = type === "recharge" || Boolean(rechargeData);
  const activeData = isRecharge ? rechargeData : receiptData;

  if (!activeData) return null;

  const receiptText = isRecharge && rechargeData
    ? generateRechargeReceiptText(rechargeData)
    : receiptData
    ? generateReceiptText(receiptData)
    : "";

  const customerName = activeData.customerName;
  const mobile = activeData.mobile;

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

  const handleSMS = () => {
    openSmsReceipt(mobile, receiptText);
    toast({
      title: "Opening SMS App",
      description: `Redirecting to SMS for ${customerName}...`,
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
            {isRecharge ? "Recharge Successful!" : "Payment Successful!"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            {isRecharge && rechargeData ? (
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

        {/* Receipt Text Preview Card */}
        <div className="my-3 p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs leading-relaxed relative border border-slate-800">
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
            onClick={handleSMS}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 text-sm shadow-md flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            Send SMS Receipt
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-10 font-semibold text-slate-700 dark:text-slate-200"
          >
            {isRecharge ? "Done / Next Recharge" : "Done / Next Collection"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
