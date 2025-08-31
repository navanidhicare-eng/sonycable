import { BillComparisonForm } from '@/components/bill-comparison-form';
import { Network } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3 text-primary">
            <Network className="h-10 w-10" />
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              SONY CABLE NETWORK
            </h1>
          </div>
          <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
            Upload your cable bills, tell us what you want, and let our AI find the perfect plan for you. Save money and get the features you love.
          </p>
        </header>
        <BillComparisonForm />
      </div>
    </main>
  );
}
