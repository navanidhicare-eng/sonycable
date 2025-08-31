
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const mockComplaints = [
  {
    id: "comp1",
    date: "2024-07-28",
    customerName: "Suresh Kumar",
    stbId: "STB12345",
    complaint: "No signal since morning.",
    status: "Pending",
  },
  {
    id: "comp2",
    date: "2024-07-27",
    customerName: "Anitha Reddy",
    stbId: "STB54321",
    complaint: "Some channels are not working.",
    status: "Resolved",
  },
];

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState(mockComplaints);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [currentComplaint, setCurrentComplaint] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("userRole");
      setUserRole(role || "");
    }
  }, []);


  const openResolveDialog = (complaint) => {
    setCurrentComplaint(complaint);
    setResolutionNotes("");
    setIsResolveDialogOpen(true);
  };

  const handleResolveComplaint = () => {
    if (!currentComplaint) return;
    
    // Update the status of the complaint in the list
    setComplaints(complaints.map(c => 
      c.id === currentComplaint.id ? { ...c, status: 'Resolved' } : c
    ));
    
    // Close the dialog
    setIsResolveDialogOpen(false);
    setCurrentComplaint(null);
  };


  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">
                Customer Complaints
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">
                Track and manage customer complaints here.
              </p>
            </div>
            <Button asChild className="mt-4 sm:mt-0">
              <Link href="/dashboard/complaints/add">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Complaint
              </Link>
            </Button>
          </header>
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <CardTitle>Complaint List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complaints.map((complaint) => (
                    <TableRow key={complaint.id}>
                      <TableCell>{new Date(complaint.date).toLocaleDateString('en-CA')}</TableCell>
                      <TableCell className="font-medium">
                        <div>{complaint.customerName}</div>
                        <div className="text-xs text-muted-foreground">{complaint.stbId}</div>
                        </TableCell>
                      <TableCell>{complaint.complaint}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            complaint.status === "Pending"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {complaint.status}
                        </Badge>
                      </TableCell>
                       <TableCell>
                        {userRole === 'Admin' && complaint.status === 'Pending' && (
                          <Button variant="outline" size="sm" onClick={() => openResolveDialog(complaint)}>
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {currentComplaint && (
        <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Resolve Complaint</DialogTitle>
              <DialogDescription>
                Add notes about how the complaint was resolved.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="resolution-notes">Resolution Notes</Label>
                <Textarea 
                  placeholder="Type your resolution notes here." 
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleResolveComplaint}>
                Mark as Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
