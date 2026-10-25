"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Search, Loader2, Upload, RefreshCw, Pencil, Trash2, ChevronLeft, ChevronRight, MapPin, Eye } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp, writeBatch, doc, getDocs, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Papa from "papaparse";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AP_LOCATIONS } from "@/lib/apLocations";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  area?: string;
  district?: string;
  mandal?: string;
  village?: string;
  stbId: string;
  customerId: string;
  gtplId?: string;
  userId: string;
  createdAt: any;
  lastRechargeDate?: Timestamp;
  customerType?: string;
}

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterMandal, setFilterMandal] = useState("all");
  const [filterVillage, setFilterVillage] = useState("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // ── Firestore listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, "customers"), where("userId", "==", user.uid)),
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
        const secs = (c: Customer) => {
          if (!c.createdAt) return 0;
          if (typeof c.createdAt.seconds === "number") return c.createdAt.seconds;
          if (c.createdAt.toDate) return c.createdAt.toDate().getTime() / 1000;
          return 0;
        };
        data.sort((a, b) => secs(b) - secs(a));
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast({ variant: "destructive", title: "Failed to fetch customers" });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user, authLoading, toast]);

  // ── Cascading filter options ───────────────────────────────────────────────
  const districtList = useMemo(() => AP_LOCATIONS.map(d => d.district), []);

  const mandalList = useMemo(() => {
    if (filterDistrict === "all") return [];
    return AP_LOCATIONS.find(d => d.district === filterDistrict)?.mandals.map(m => m.mandal) ?? [];
  }, [filterDistrict]);

  const villageList = useMemo(() => {
    if (filterDistrict === "all" || filterMandal === "all") return [];
    const dist = AP_LOCATIONS.find(d => d.district === filterDistrict);
    return dist?.mandals.find(m => m.mandal === filterMandal)?.villages ?? [];
  }, [filterDistrict, filterMandal]);

  // Reset downstream when parent changes
  useEffect(() => { setFilterMandal("all"); setFilterVillage("all"); setPage(1); }, [filterDistrict]);
  useEffect(() => { setFilterVillage("all"); setPage(1); }, [filterMandal]);
  useEffect(() => { setPage(1); }, [searchTerm, filterVillage]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter(c => {
      const matchSearch =
        !term ||
        c.name?.toLowerCase().includes(term) ||
        c.mobile?.includes(term) ||
        c.stbId?.toLowerCase().includes(term) ||
        c.customerId?.toLowerCase().includes(term) ||
        c.gtplId?.toLowerCase().includes(term);

      const matchDistrict = filterDistrict === "all" || c.district === filterDistrict;
      const matchMandal = filterMandal === "all" || c.mandal === filterMandal;
      const matchVillage =
        filterVillage === "all" ||
        c.village === filterVillage ||
        c.area === filterVillage;

      return matchSearch && matchDistrict && matchMandal && matchVillage;
    });
  }, [customers, searchTerm, filterDistrict, filterMandal, filterVillage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (ts?: Timestamp) => {
    if (!ts) return "—";
    try { return format(ts.toDate(), "dd MMM yyyy"); } catch { return "—"; }
  };

  const locationLabel = (c: Customer) => {
    const parts = [c.village || c.area, c.mandal].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };

  // ── Bulk upload ────────────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const required = ["customerName", "mobileNumber", "area", "stbId", "customerId"];
        const missing = required.filter(h => !(results.meta.fields || []).includes(h));
        if (missing.length) {
          toast({ variant: "destructive", title: "Invalid CSV", description: `Missing: ${missing.join(", ")}` });
          setIsUploading(false); return;
        }
        try {
          const batch = writeBatch(db);
          (results.data as any[]).forEach(cust => {
            const ref = doc(collection(db, "customers"));
            const lrd = cust.lastRechargeDate ? new Date(cust.lastRechargeDate) : null;
            let exp: Date | null = null;
            if (lrd) { exp = new Date(lrd); exp.setDate(exp.getDate() + 30); }
            batch.set(ref, {
              name: cust.customerName, mobile: cust.mobileNumber, area: cust.area,
              stbId: cust.stbId, customerId: cust.customerId,
              balanceAmount: parseFloat(cust.balanceAmount) || 0,
              lastRechargeDate: lrd ? Timestamp.fromDate(lrd) : null,
              expiryDate: exp ? Timestamp.fromDate(exp) : null,
              createdAt: Timestamp.fromDate(new Date()), userId: user.uid,
            });
          });
          await batch.commit();
          toast({ title: "Upload Successful", description: `${results.data.length} customers added.` });
        } catch { toast({ variant: "destructive", title: "Upload Failed" }); }
        finally { setIsUploading(false); setIsUploadDialogOpen(false); }
      },
      error: (err: any) => { toast({ variant: "destructive", title: "File Error", description: err.message }); setIsUploading(false); }
    });
  };

  const generateCsvTemplate = () => {
    const content = "customerName,mobileNumber,area,stbId,customerId,balanceAmount,lastRechargeDate\nJohn Doe,9876543210,Main Area,123456789,CUST001,50,2024-01-15";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    a.download = "customer_template.csv";
    a.click();
  };

  // ── Sync areas ─────────────────────────────────────────────────────────────
  const handleSyncAreas = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const unique = new Set(customers.map(c => (c.area || "").trim()).filter(Boolean));
      const snap = await getDocs(query(collection(db, "areas"), where("userId", "==", user.uid)));
      const existing = new Set(snap.docs.map(d => d.data().name.trim()));
      const newAreas = [...unique].filter(a => !existing.has(a));
      if (!newAreas.length) { toast({ title: "Areas Synced", description: "All areas are up to date." }); return; }
      const batch = writeBatch(db);
      newAreas.forEach(name => batch.set(doc(collection(db, "areas")), { name, userId: user.uid, createdAt: new Date(), description: "Auto-synced" }));
      await batch.commit();
      toast({ title: "Sync Successful", description: `${newAreas.length} new area(s) added.` });
    } catch { toast({ variant: "destructive", title: "Sync Failed" }); }
    finally { setIsSyncing(false); }
  };

  const openDeleteDialog = (c: Customer) => { setCustomerToDelete(c); setIsDeleteDialogOpen(true); };
  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await deleteDoc(doc(db, "customers", customerToDelete.id));
      toast({ title: "Customer Deleted", description: `${customerToDelete.name} removed.` });
    } catch { toast({ variant: "destructive", title: "Deletion Failed" }); }
    finally { setIsDeleteDialogOpen(false); setCustomerToDelete(null); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground bg-muted/30">
        <div className="container mx-auto px-3 sm:px-6 py-6 max-w-7xl">

          {/* ── Page Header ── */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your customer information here.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSyncAreas} disabled={isSyncing} className="h-8 text-xs">
                {isSyncing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Sync Areas
              </Button>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Upload className="mr-1.5 h-3.5 w-3.5" /> Bulk Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Upload Customers</DialogTitle>
                    <DialogDescription>Upload a CSV file. Required: customerName, mobileNumber, area, stbId, customerId.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <Button variant="link" onClick={generateCsvTemplate} className="p-0 h-auto text-sm">Download CSV Template</Button>
                    <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                    {isUploading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</div>}
                  </div>
                </DialogContent>
              </Dialog>
              <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white" asChild>
                <Link href="/dashboard/customers/add">
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Customer
                </Link>
              </Button>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Customer List</CardTitle>
                <span className="text-xs text-muted-foreground">{filtered.length} customers</span>
              </div>

              {/* ── Filters Row ── */}
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Name, Mobile, STB VC, or Customer ID..."
                    className="pl-9 h-9 text-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                {/* Cascading Location Filters */}
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                    <SelectTrigger className="h-9 text-xs w-[150px]"><SelectValue placeholder="All Districts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districtList.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterMandal} onValueChange={setFilterMandal} disabled={filterDistrict === "all"}>
                    <SelectTrigger className="h-9 text-xs w-[140px]"><SelectValue placeholder="All Mandals" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Mandals</SelectItem>
                      {mandalList.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterVillage} onValueChange={setFilterVillage} disabled={filterMandal === "all"}>
                    <SelectTrigger className="h-9 text-xs w-[150px]"><SelectValue placeholder="All Villages" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Villages</SelectItem>
                      {villageList.map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading || authLoading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* ── Mobile Card View ── */}
                  <div className="block md:hidden divide-y">
                    {paginated.length > 0 ? paginated.map(c => (
                      <div key={c.id} className="p-3 hover:bg-muted/40 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link href={`/dashboard/customers/history?id=${c.id}`} className="font-semibold text-sm text-primary hover:underline">{c.name}</Link>
                            <div className="text-xs text-muted-foreground mt-0.5">📞 {c.mobile}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link href={`/dashboard/customers/history?id=${c.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <Link href={`/dashboard/customers/edit?id=${c.id}`}><Pencil className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog(c)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          <div className="bg-muted/50 p-1.5 rounded-md">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Location</span>
                            <span className="font-medium truncate block">{locationLabel(c)}</span>
                          </div>
                          <div className="bg-muted/50 p-1.5 rounded-md">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">STB VC</span>
                            <span className="font-medium truncate block">{c.stbId || "—"}</span>
                          </div>
                          <div className="bg-muted/50 p-1.5 rounded-md">
                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Last Recharge</span>
                            <span className="font-medium block">{formatDate(c.lastRechargeDate)}</span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-14 text-center text-sm text-muted-foreground">No customers found.</div>
                    )}
                  </div>

                  {/* ── Desktop Table View ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-semibold">#</TableHead>
                          <TableHead className="text-xs font-semibold">Customer Name</TableHead>
                          <TableHead className="text-xs font-semibold">Mobile</TableHead>
                          <TableHead className="text-xs font-semibold">Location</TableHead>
                          <TableHead className="text-xs font-semibold">STB VC Number</TableHead>
                          <TableHead className="text-xs font-semibold">Customer ID</TableHead>
                          <TableHead className="text-xs font-semibold">Last Recharge</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.length > 0 ? paginated.map((c, idx) => (
                          <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-xs text-muted-foreground w-10">
                              {(page - 1) * PAGE_SIZE + idx + 1}
                            </TableCell>
                            <TableCell>
                              <div>
                                <Link href={`/dashboard/customers/history?id=${c.id}`} className="font-semibold text-sm text-primary hover:underline">
                                  {c.name}
                                </Link>
                                {c.customerType && (
                                  <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.customerType === "DTH" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                    {c.customerType}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{c.mobile}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[160px]">{locationLabel(c)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono text-xs">{c.stbId || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div>{c.customerId}</div>
                              {c.gtplId && (
                                <div className="text-[10px] text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 font-mono font-medium rounded px-1.5 py-0.5 mt-0.5 inline-block">
                                  GTPL: {c.gtplId}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(c.lastRechargeDate)}</TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="View Profile" asChild>
                                  <Link href={`/dashboard/customers/history?id=${c.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" asChild>
                                  <Link href={`/dashboard/customers/edit?id=${c.id}`}><Pencil className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete" onClick={() => openDeleteDialog(c)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                              No customers found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* ── Pagination ── */}
                  {filtered.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                      <span>
                        Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} customers
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-2 font-medium">{page} / {totalPages}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-bold">{customerToDelete?.name}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
