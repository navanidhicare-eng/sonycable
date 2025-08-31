
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockPayments = [
  {
    id: "pay1",
    date: "2024-07-01",
    amount: "50000",
    transactionId: "TXN123456789",
  },
  {
    id: "pay2",
    date: "2024-06-01",
    amount: "48000",
    transactionId: "TXN987654321",
  },
];


export default function MsoPaymentsPage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              MSO Payments
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Track your payments to the MSO here.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/mso-payments/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Payment
            </Link>
          </Button>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Transaction ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">₹{payment.amount}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{payment.transactionId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
