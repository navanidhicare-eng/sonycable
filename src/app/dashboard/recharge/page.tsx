
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RechargePage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Recharge
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Recharge customer accounts here.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Recharge Section</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Recharge functionality will be implemented here.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
