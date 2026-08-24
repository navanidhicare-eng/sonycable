import { Suspense } from "react";
import EditCustomerClient from "./Client";
import { Loader2 } from "lucide-react";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function EditCustomerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <EditCustomerClient />
    </Suspense>
  );
}
