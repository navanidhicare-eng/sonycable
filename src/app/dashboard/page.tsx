
import { BillComparisonForm } from '@/components/bill-comparison-form';

export default function DashboardPage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
            Dashboard
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
            Upload your cable bills, tell us what you want, and let our AI find the perfect plan for you. Save money and get the features you love.
          </p>
        </header>
        <BillComparisonForm />
      </div>
    </main>
  );
}
