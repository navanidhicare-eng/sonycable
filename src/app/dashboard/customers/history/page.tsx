"use client";

import { Suspense } from "react";
import CustomerHistoryClient from "../[id]/history/Client";
import { Loader2 } from "lucide-react";

export default function StaticCustomerHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CustomerHistoryClient />
    </Suspense>
  );
}
