"use client";

import { Suspense } from "react";
import CustomerHistoryClient from "../dashboard/customers/[id]/history/Client";
import { Loader2 } from "lucide-react";

function PassbookContent() {
  return <CustomerHistoryClient />;
}

export default function PassbookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PassbookContent />
    </Suspense>
  );
}
