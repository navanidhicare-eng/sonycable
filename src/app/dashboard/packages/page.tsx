import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PackagesPage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Packages
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your cable packages here.
            </p>
          </div>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Package List</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Package details will be displayed here.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
