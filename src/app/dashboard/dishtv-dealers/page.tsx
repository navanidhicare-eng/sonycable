"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Store,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Phone,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  MapPin,
  Share2,
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AP_LOCATIONS, CustomLocation, getMergedLocations } from "@/lib/apLocations";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

function getSecondaryAuth() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const secondaryApp =
    getApps().find((app) => app.name === "SecondaryAuthApp") ||
    initializeApp(firebaseConfig, "SecondaryAuthApp");
  return getAuth(secondaryApp);
}

export interface DishTvDealer {
  id: string;
  uid?: string;
  dealerName: string;
  contactPerson: string;
  mobile: string;
  loginId: string;
  formattedEmail?: string;
  password?: string;
  district?: string;
  mandal?: string;
  village?: string;
  status: "Active" | "Inactive";
  notes?: string;
  userId: string;
  createdAt: Timestamp;
}

export default function DishTvDealersPage() {
  const [dealers, setDealers] = useState<DishTvDealer[]>([]);
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isAddOrEditOpen, setIsAddOrEditOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<DishTvDealer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [dealerToDelete, setDealerToDelete] = useState<DishTvDealer | null>(null);

  // Show/Hide Password State per row
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [showModalPassword, setShowModalPassword] = useState(false);

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    dealerName: "",
    contactPerson: "",
    mobile: "",
    loginId: "",
    password: "",
    district: "Anakapalli",
    mandal: "V.Madugula",
    village: "Pothanapudi Agraharam",
    status: "Active" as "Active" | "Inactive",
    notes: "",
  });

  // Merged Locations logic
  const allLocations = useMemo(() => {
    return getMergedLocations(customLocations);
  }, [customLocations]);

  const availableMandals = useMemo(() => {
    const distObj = allLocations.find((d) => d.district === formData.district);
    return distObj ? distObj.mandals.map((m) => m.mandal) : [];
  }, [allLocations, formData.district]);

  const availableVillages = useMemo(() => {
    const distObj = allLocations.find((d) => d.district === formData.district);
    const mandalObj = distObj?.mandals.find((m) => m.mandal === formData.mandal);
    return mandalObj ? mandalObj.villages : [];
  }, [allLocations, formData.district, formData.mandal]);

  // Fetch Dealers and Custom Locations
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const qDealers = query(collection(db, "dishtv_dealers"), where("userId", "==", user.uid));
    const unsubscribeDealers = onSnapshot(
      qDealers,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DishTvDealer[];

        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setDealers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching DishTV dealers:", error);
        toast({
          variant: "destructive",
          title: "Error loading dealers",
          description: "Could not retrieve DishTV dealer accounts.",
        });
        setLoading(false);
      }
    );

    const qLocs = query(collection(db, "custom_locations"), where("userId", "==", user.uid));
    const unsubscribeLocs = onSnapshot(qLocs, (snapshot) => {
      const locsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CustomLocation[];
      setCustomLocations(locsData);
    });

    return () => {
      unsubscribeDealers();
      unsubscribeLocs();
    };
  }, [user, authLoading, toast]);

  // Toggle Password visibility
  const toggleShowPassword = (dealerId: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [dealerId]: !prev[dealerId],
    }));
  };

  // Copy Credentials to Clipboard
  const handleCopyCredentials = (dealer: DishTvDealer) => {
    const text = `DishTV Dealer Account Credentials:\nDealer Name: ${dealer.dealerName}\nLogin ID: ${dealer.loginId}\nPassword: ${dealer.password || "N/A"}\nTerritory: ${dealer.village || ""}, ${dealer.mandal || ""}, ${dealer.district || ""}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Credentials Copied!",
      description: `Login details for ${dealer.dealerName} copied to clipboard.`,
    });
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingDealer(null);
    setShowModalPassword(false);

    const firstDist = allLocations[0]?.district || "Anakapalli";
    const firstMandal = allLocations[0]?.mandals[0]?.mandal || "V.Madugula";
    const firstVillage = allLocations[0]?.mandals[0]?.villages[0] || "Pothanapudi Agraharam";

    setFormData({
      dealerName: "",
      contactPerson: "",
      mobile: "",
      loginId: "",
      password: "",
      district: firstDist,
      mandal: firstMandal,
      village: firstVillage,
      status: "Active",
      notes: "",
    });
    setIsAddOrEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (dealer: DishTvDealer) => {
    setEditingDealer(dealer);
    setShowModalPassword(false);

    setFormData({
      dealerName: dealer.dealerName || "",
      contactPerson: dealer.contactPerson || "",
      mobile: dealer.mobile || "",
      loginId: dealer.loginId || "",
      password: dealer.password || "",
      district: dealer.district || allLocations[0]?.district || "Anakapalli",
      mandal: dealer.mandal || "V.Madugula",
      village: dealer.village || "Pothanapudi Agraharam",
      status: dealer.status || "Active",
      notes: dealer.notes || "",
    });
    setIsAddOrEditOpen(true);
  };

  // Save Dealer (Add or Update)
  const handleSaveDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.dealerName.trim() || !formData.loginId.trim() || !formData.password.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in Dealer Name, Login ID, and Password.",
      });
      return;
    }

    if (formData.password.trim().length < 6) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password must be at least 6 characters.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const trimmedLoginId = formData.loginId.trim();
      const formattedEmail = trimmedLoginId.includes("@")
        ? trimmedLoginId
        : `${trimmedLoginId}@sonycable.local`;

      const dealerPayload = {
        dealerName: formData.dealerName.trim(),
        contactPerson: formData.contactPerson.trim(),
        mobile: formData.mobile.trim(),
        loginId: trimmedLoginId,
        formattedEmail: formattedEmail,
        password: formData.password.trim(),
        district: formData.district.trim(),
        mandal: formData.mandal.trim(),
        village: formData.village.trim(),
        status: formData.status,
        notes: formData.notes.trim(),
      };

      if (editingDealer) {
        await updateDoc(doc(db, "dishtv_dealers", editingDealer.id), dealerPayload);
        toast({
          title: "Dealer Account Updated",
          description: `Updated credentials for ${formData.dealerName}.`,
        });
      } else {
        let authUid = "";
        try {
          const secondaryAuth = getSecondaryAuth();
          const userCred = await createUserWithEmailAndPassword(
            secondaryAuth,
            formattedEmail,
            formData.password.trim()
          );
          authUid = userCred.user.uid;
        } catch (authErr: any) {
          if (authErr.code === "auth/email-already-in-use") {
            toast({
              variant: "destructive",
              title: "Login ID Exists",
              description: "A dealer with this Login ID / Email already exists.",
            });
            setIsSaving(false);
            return;
          }
          console.error("Firebase auth error during dealer creation:", authErr);
        }

        await addDoc(collection(db, "dishtv_dealers"), {
          ...dealerPayload,
          uid: authUid,
          userId: user.uid,
          createdAt: Timestamp.now(),
        });

        toast({
          title: "Dealer Account Created",
          description: `Login credentials activated for ${formData.dealerName}.`,
        });
      }

      setIsAddOrEditOpen(false);
    } catch (error) {
      console.error("Error saving dealer:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "An error occurred while saving dealer details.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Dealer
  const handleDeleteDealer = async () => {
    if (!dealerToDelete) return;

    try {
      await deleteDoc(doc(db, "dishtv_dealers", dealerToDelete.id));
      toast({
        title: "Dealer Deleted",
        description: `${dealerToDelete.dealerName} account removed successfully.`,
      });
    } catch (error) {
      console.error("Error deleting dealer:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "Could not remove dealer account.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDealerToDelete(null);
    }
  };

  // Filtered Dealers
  const filteredDealers = useMemo(() => {
    return dealers.filter((d) => {
      const matchesSearch =
        d.dealerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.mobile?.includes(searchTerm) ||
        d.loginId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.district?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDistrict = filterDistrict === "all" || d.district === filterDistrict;
      const matchesStatus = filterStatus === "all" || d.status === filterStatus;

      return matchesSearch && matchesDistrict && matchesStatus;
    });
  }, [dealers, searchTerm, filterDistrict, filterStatus]);

  const activeCount = useMemo(() => dealers.filter((d) => d.status === "Active").length, [dealers]);
  const uniqueDistrictsCount = useMemo(
    () => new Set(dealers.map((d) => d.district).filter(Boolean)).size,
    [dealers]
  );

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/20 pb-12">
      <div className="container mx-auto p-4 py-8 md:p-8 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
                <Store className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">DishTV Dealers</h1>
                <p className="text-muted-foreground mt-1">
                  Create and manage DishTV dealer login IDs, passwords, and territory access.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenAdd}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add DishTV Dealer
            </Button>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Dealers</CardTitle>
              <Store className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dealers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered DishTV Dealer Accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Dealers with active access</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Covered Districts</CardTitle>
              <MapPin className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueDistrictsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Districts assigned to dealers</p>
            </CardContent>
          </Card>
        </div>

        {/* Directory Section */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-card pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">DishTV Dealer Directory</CardTitle>
                <CardDescription>
                  Showing {filteredDealers.length} of {dealers.length} registered dealers
                </CardDescription>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, mobile, ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-background h-9 text-sm"
                  />
                </div>

                <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                  <SelectTrigger className="w-full sm:w-40 h-9">
                    <SelectValue placeholder="District" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {allLocations.map((loc) => (
                      <SelectItem key={loc.district} value={loc.district}>
                        {loc.district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-36 h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading || authLoading ? (
              <div className="flex justify-center items-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-3 text-amber-500" />
                <span>Loading dealer directory...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Dealer / Business Name</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Territory (Location)</TableHead>
                      <TableHead>Login ID & Password</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDealers.length > 0 ? (
                      filteredDealers.map((dlr) => {
                        const isPasswordVisible = !!showPasswordMap[dlr.id];
                        return (
                          <TableRow key={dlr.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div>
                                <div className="font-semibold text-foreground">{dlr.dealerName}</div>
                                {dlr.contactPerson && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Contact: {dlr.contactPerson}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                {dlr.mobile || "N/A"}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {dlr.village || "N/A"}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {[dlr.mandal, dlr.district].filter(Boolean).join(", ")}
                                </div>
                              </div>
                            </TableCell>

                            {/* Login ID & Password Box */}
                            <TableCell>
                              <div className="bg-muted/50 p-2 rounded-md border space-y-1 w-60">
                                <div className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-muted-foreground">ID:</span>
                                  <span className="font-bold text-amber-600 dark:text-amber-400">
                                    {dlr.loginId}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono pt-0.5 border-t border-muted">
                                  <span className="text-muted-foreground">Pass:</span>
                                  <div className="flex items-center gap-1">
                                    <span>
                                      {isPasswordVisible ? dlr.password || "N/A" : "••••••••"}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                      onClick={() => toggleShowPassword(dlr.id)}
                                    >
                                      {isPasswordVisible ? (
                                        <EyeOff className="h-3 w-3" />
                                      ) : (
                                        <Eye className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              {dlr.status === "Active" ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                  <XCircle className="mr-1 h-3 w-3" /> Inactive
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Copy Login Details"
                                  onClick={() => handleCopyCredentials(dlr)}
                                >
                                  <Copy className="h-4 w-4 text-amber-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit Dealer"
                                  onClick={() => handleOpenEdit(dlr)}
                                >
                                  <Pencil className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete Dealer"
                                  onClick={() => {
                                    setDealerToDelete(dlr);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No DishTV dealers found matching your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Dealer Dialog */}
      <Dialog open={isAddOrEditOpen} onOpenChange={setIsAddOrEditOpen}>
        <DialogContent className="max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-amber-600" />
              {editingDealer ? "Edit DishTV Dealer Account" : "Add New DishTV Dealer"}
            </DialogTitle>
            <DialogDescription>
              Assign login ID, password, and operational territory to DishTV dealer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDealer} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dealer Name */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="dlrName">Dealer / Business Name *</Label>
                <Input
                  id="dlrName"
                  placeholder="e.g. Venkateswara DishTV Services"
                  value={formData.dealerName}
                  onChange={(e) => setFormData({ ...formData, dealerName: e.target.value })}
                  required
                />
              </div>

              {/* Contact Person */}
              <div className="space-y-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <Label htmlFor="mobile">Mobile Number *</Label>
                <Input
                  id="mobile"
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  required
                />
              </div>

              {/* Login ID */}
              <div className="space-y-1.5">
                <Label htmlFor="loginId">Assigned Login ID / Username *</Label>
                <Input
                  id="loginId"
                  placeholder="e.g. dealer.madugula@dishtv"
                  value={formData.loginId}
                  onChange={(e) => setFormData({ ...formData, loginId: e.target.value })}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Assigned Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showModalPassword ? "text" : "password"}
                    placeholder="Set password..."
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                  >
                    {showModalPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Territory Section */}
            <div className="pt-2 border-t space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned Territory (District / Mandal / Village)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* District */}
                <div className="space-y-1">
                  <Label htmlFor="district" className="text-xs text-muted-foreground">District</Label>
                  <Select
                    value={formData.district}
                    onValueChange={(val) => {
                      const newDist = allLocations.find((d) => d.district === val);
                      const firstMandal = newDist?.mandals[0]?.mandal || "";
                      const firstVillage = newDist?.mandals[0]?.villages[0] || "";
                      setFormData({
                        ...formData,
                        district: val,
                        mandal: firstMandal,
                        village: firstVillage,
                      });
                    }}
                  >
                    <SelectTrigger id="district" className="h-9 text-sm">
                      <SelectValue placeholder="Select District" />
                    </SelectTrigger>
                    <SelectContent>
                      {allLocations.map((loc) => (
                        <SelectItem key={loc.district} value={loc.district}>
                          {loc.district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mandal */}
                <div className="space-y-1">
                  <Label htmlFor="mandal" className="text-xs text-muted-foreground">Mandal</Label>
                  <Select
                    value={formData.mandal}
                    onValueChange={(val) => {
                      const currentDist = allLocations.find((d) => d.district === formData.district);
                      const selectedMandalObj = currentDist?.mandals.find((m) => m.mandal === val);
                      const firstVillage = selectedMandalObj?.villages[0] || "";
                      setFormData({
                        ...formData,
                        mandal: val,
                        village: firstVillage,
                      });
                    }}
                  >
                    <SelectTrigger id="mandal" className="h-9 text-sm">
                      <SelectValue placeholder="Select Mandal" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMandals.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Village */}
                <div className="space-y-1">
                  <Label htmlFor="village" className="text-xs text-muted-foreground">Village</Label>
                  <Select
                    value={formData.village}
                    onValueChange={(val) => setFormData({ ...formData, village: val })}
                  >
                    <SelectTrigger id="village" className="h-9 text-sm">
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVillages.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Status & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-1.5">
                <Label htmlFor="status">Account Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: "Active" | "Inactive") => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger id="status" className="h-9">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes / Remarks</Label>
                <Input
                  id="notes"
                  placeholder="Optional internal notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOrEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingDealer ? "Update Dealer Account" : "Create Dealer Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dealer Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete login credentials for{" "}
              <strong>{dealerToDelete?.dealerName}</strong> (Login ID: {dealerToDelete?.loginId}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDealer}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Dealer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
