
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

const mockPackages = [
  {
    id: "pkg1",
    name: "SONY BASIC",
    amount: "250",
    description: "Basic channels for family entertainment.",
  },
  {
    id: "pkg2",
    name: "SONY PREMIUM",
    amount: "450",
    description: "Includes all basic channels plus premium sports and movie channels.",
  },
  {
    id: "pkg3",
    name: "SONY HD+ PACK",
    amount: "550",
    description: "All channels in HD quality for the best viewing experience.",
  },
];


export default function PackagesPage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Packages
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your cable packages here.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/packages/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Package
            </Link>
          </Button>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Package List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package Name</TableHead>
                  <TableHead>Amount (₹)</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPackages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">{pkg.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">₹{pkg.amount}</Badge>
                    </TableCell>
                    <TableCell>{pkg.description}</TableCell>
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
