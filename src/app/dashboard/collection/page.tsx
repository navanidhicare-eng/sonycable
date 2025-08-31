
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CollectionPage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Collection
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your collections here.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Collection Section</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Collection management functionality will be implemented here.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
