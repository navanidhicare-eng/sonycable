
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

const mockStaff = [
  {
    id: "staff1",
    name: "Ravi Kumar",
    mobile: "9123456780",
    area: "KPHB",
    username: "ravi_k"
  },
  {
    id: "staff2",
    name: "Anil Yadav",
    mobile: "9123456781",
    area: "Nizampet",
    username: "anil_y"
  },
   {
    id: "staff3",
    name: "Kiran Goud",
    mobile: "9123456782",
    area: "All Areas",
    username: "kiran_g"
  },
];


export default function StaffPage() {
  return (
    <main className="min-h-screen w-full font-body text-foreground">
      <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
        <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
              Staff Management
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
              Manage your collection agents and other staff here.
            </p>
          </div>
          <Button asChild className="mt-4 sm:mt-0">
            <Link href="/dashboard/staff/add">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Staff
            </Link>
          </Button>
        </header>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Staff List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Assigned Area</TableHead>
                  <TableHead>Username</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.mobile}</TableCell>
                    <TableCell>{staff.area}</TableCell>
                    <TableCell>{staff.username}</TableCell>
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
