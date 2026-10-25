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
  ShoppingBag,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Phone,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  MapPin,
  Building2,
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
import { CustomLocation, getMergedLocations } from "@/lib/apLocations";

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

export interface DishTvRetailer {
  id: string;
  uid?: string;
  retailerName: string;
  contactPerson: string;
  mobile: string;
  address: string;
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

export default function DishTvRetailersPage() {
  const [retailers, setRetailers] = useState<DishTvRetailer[]>([]);
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isAddOrEditOpen, setIsAddOrEditOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<DishTvRetailer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [retailerToDelete, setRetailerToDelete] = useState<DishTvRetailer | null>(null);

  // Show/Hide Password State per row
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [showModalPassword, setShowModalPassword] = useState(false);

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    retailerName: "",
    contactPerson: "",
    mobile: "",
    address: "",
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

  // Fetch Retailers and Custom Locations
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const qRetailers = query(collection(db, "dishtv_retailers"), where("userId", "==", user.uid));
    const unsubscribeRetailers = onSnapshot(
      qRetailers,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DishTvRetailer[];

        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setRetailers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching DishTV retailers:", error);
        toast({
          variant: "destructive",
          title: "Error loading retailers",
          description: "Could not retrieve DishTV retailer accounts.",
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
      unsubscribeRetailers();
      unsubscribeLocs();
    };
  }, [user, authLoading, toast]);

  // Toggle Password visibility
  const toggleShowPassword = (retailerId: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [retailerId]: !prev[retailerId],
    }));
  };

  // Copy Credentials to Clipboard
  const handleCopyCredentials = (retailer: DishTvRetailer) => {
    const text = `DishTV Retailer Account Credentials:\nRetailer Name: ${retailer.retailerName}\nLogin ID: ${retailer.loginId}\nPassword: ${retailer.password || "N/A"}\nAddress: ${retailer.address || "N/A"}\nLocation: ${retailer.village || ""}, ${retailer.mandal || ""}, ${retailer.district || ""}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Credentials Copied!",
      description: `Login details for ${retailer.retailerName} copied to clipboard.`,
    });
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingRetailer(null);
    setShowModalPassword(false);

    const firstDist = allLocations[0]?.district || "Anakapalli";
    const firstMandal = allLocations[0]?.mandals[0]?.mandal || "V.Madugula";
    const firstVillage = allLocations[0]?.mandals[0]?.villages[0] || "Pothanapudi Agraharam";

    setFormData({
      retailerName: "",
      contactPerson: "",
      mobile: "",
      address: "",
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
  const handleOpenEdit = (retailer: DishTvRetailer) => {
    setEditingRetailer(retailer);
    setShowModalPassword(false);

    setFormData({
      retailerName: retailer.retailerName || "",
      contactPerson: retailer.contactPerson || "",
      mobile: retailer.mobile || "",
      address: retailer.address || "",
      loginId: retailer.loginId || "",
      password: retailer.password || "",
      district: retailer.district || allLocations[0]?.district || "Anakapalli",
      mandal: retailer.mandal || "V.Madugula",
      village: retailer.village || "Pothanapudi Agraharam",
      status: retailer.status || "Active",
      notes: retailer.notes || "",
    });
    setIsAddOrEditOpen(true);
  };

  // Save Retailer (Add or Update)
  const handleSaveRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.retailerName.trim() || !formData.loginId.trim() || !formData.password.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in Retailer Name, Login ID, and Password.",
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

      const retailerPayload = {
        retailerName: formData.retailerName.trim(),
        contactPerson: formData.contactPerson.trim(),
        mobile: formData.mobile.trim(),
        address: formData.address.trim(),
        loginId: trimmedLoginId,
        formattedEmail: formattedEmail,
        password: formData.password.trim(),
        district: formData.district.trim(),
        mandal: formData.mandal.trim(),
        village: formData.village.trim(),
        status: formData.status,
        notes: formData.notes.trim(),
      };

      if (editingRetailer) {
        await updateDoc(doc(db, "dishtv_retailers", editingRetailer.id), retailerPayload);
        toast({
          title: "Retailer Account Updated",
          description: `Updated credentials for ${formData.retailerName}.`,
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
              description: "A retailer with this Login ID / Email already exists.",
            });
            setIsSaving(false);
            return;
          }
          console.error("Firebase auth error during retailer creation:", authErr);
        }

        await addDoc(collection(db, "dishtv_retailers"), {
          ...retailerPayload,
          uid: authUid,
          userId: user.uid,
          createdAt: Timestamp.now(),
        });

        toast({
          title: "Retailer Account Created",
          description: `Login credentials activated for ${formData.retailerName}.`,
        });
      }

      setIsAddOrEditOpen(false);
    } catch (error) {
      console.error("Error saving retailer:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "An error occurred while saving retailer details.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Retailer
  const handleDeleteRetailer = async () => {
    if (!retailerToDelete) return;

    try {
      await deleteDoc(doc(db, "dishtv_retailers", retailerToDelete.id));
      toast({
        title: "Retailer Deleted",
        description: `${retailerToDelete.retailerName} account removed successfully.`,
      });
    } catch (error) {
      console.error("Error deleting retailer:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "Could not remove retailer account.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setRetailerToDelete(null);
    }
  };

  // Filtered Retailers
  const filteredRetailers = useMemo(() => {
    return retailers.filter((r) => {
      const matchesSearch =
        r.retailerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.mobile?.includes(searchTerm) ||
        r.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.loginId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.district?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDistrict = filterDistrict === "all" || r.district === filterDistrict;
      const matchesStatus = filterStatus === "all" || r.status === filterStatus;

      return matchesSearch && matchesDistrict && matchesStatus;
    });
  }, [retailers, searchTerm, filterDistrict, filterStatus]);

  const activeCount = useMemo(() => retailers.filter((r) => r.status === "Active").length, [retailers]);
  const uniqueDistrictsCount = useMemo(
    () => new Set(retailers.map((r) => r.district).filter(Boolean)).size,
    [retailers]
  );

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/20 pb-12">
      <div className="container mx-auto p-4 py-8 md:p-8 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-400">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">DishTV Retailers</h1>
                <p className="text-muted-foreground mt-1">
                  Create and manage DishTV retailer login IDs, passwords, and shop addresses.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleOpenAdd}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium shadow"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add DishTV Retailer
            </Button>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Retailers</CardTitle>
              <ShoppingBag className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retailers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered DishTV Retailer Accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Retailers with active access</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Covered Districts</CardTitle>
              <MapPin className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueDistrictsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Districts with retailer coverage</p>
            </CardContent>
          </Card>
        </div>

        {/* Directory Section */}
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-card pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">DishTV Retailer Directory</CardTitle>
                <CardDescription>
                  Showing {filteredRetailers.length} of {retailers.length} registered retailers
                </CardDescription>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, mobile, address, ID..."
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
                <Loader2 className="h-8 w-8 animate-spin mr-3 text-orange-500" />
                <span>Loading retailer directory...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Retailer / Shop Name</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Retailer Address & Location</TableHead>
                      <TableHead>Login ID & Password</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRetailers.length > 0 ? (
                      filteredRetailers.map((rtl) => {
                        const isPasswordVisible = !!showPasswordMap[rtl.id];
                        return (
                          <TableRow key={rtl.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div>
                                <div className="font-semibold text-foreground">{rtl.retailerName}</div>
                                {rtl.contactPerson && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Contact: {rtl.contactPerson}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                {rtl.mobile || "N/A"}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="max-w-xs">
                                {rtl.address && (
                                  <div className="text-sm font-medium text-foreground flex items-start gap-1">
                                    <Building2 className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                                    <span>{rtl.address}</span>
                                  </div>
                                )}
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {[rtl.village, rtl.mandal, rtl.district].filter(Boolean).join(", ")}
                                </div>
                              </div>
                            </TableCell>

                            {/* Login ID & Password Box */}
                            <TableCell>
                              <div className="bg-muted/50 p-2 rounded-md border space-y-1 w-60">
                                <div className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-muted-foreground">ID:</span>
                                  <span className="font-bold text-orange-600 dark:text-orange-400">
                                    {rtl.loginId}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono pt-0.5 border-t border-muted">
                                  <span className="text-muted-foreground">Pass:</span>
                                  <div className="flex items-center gap-1">
                                    <span>
                                      {isPasswordVisible ? rtl.password || "N/A" : "••••••••"}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                      onClick={() => toggleShowPassword(rtl.id)}
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
                              {rtl.status === "Active" ? (
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
                                  onClick={() => handleCopyCredentials(rtl)}
                                >
                                  <Copy className="h-4 w-4 text-orange-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Edit Retailer"
                                  onClick={() => handleOpenEdit(rtl)}
                                >
                                  <Pencil className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete Retailer"
                                  onClick={() => {
                                    setRetailerToDelete(rtl);
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
                          No DishTV retailers found matching your filters.
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

      {/* Add / Edit Retailer Dialog */}
      <Dialog open={isAddOrEditOpen} onOpenChange={setIsAddOrEditOpen}>
        <DialogContent className="max-w-md md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-orange-600" />
              {editingRetailer ? "Edit DishTV Retailer Account" : "Add New DishTV Retailer"}
            </DialogTitle>
            <DialogDescription>
              Assign login ID, password, and shop address details to DishTV retailer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRetailer} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Retailer Name */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rtlName">Retailer / Shop Name *</Label>
                <Input
                  id="rtlName"
                  placeholder="e.g. Sri Lakshmi DishTV Retailer"
                  value={formData.retailerName}
                  onChange={(e) => setFormData({ ...formData, retailerName: e.target.value })}
                  required
                />
              </div>

              {/* Contact Person */}
              <div className="space-y-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  placeholder="e.g. Suresh Babu"
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
                  placeholder="e.g. retailer.madugula@dishtv"
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

            {/* Address & Location Section */}
            <div className="pt-2 border-t space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Retailer Address & Location
              </Label>
              
              <div className="space-y-1.5">
                <Label htmlFor="address">Retailer Shop Address *</Label>
                <Input
                  id="address"
                  placeholder="e.g. D.No 4-12, Main Road, Opp SBI Bank"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
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
                  <Label htmlFor="village" className="text-xs text-muted-foreground">Village / City</Label>
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
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRetailer ? "Update Retailer Account" : "Create Retailer Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Retailer Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete login credentials for{" "}
              <strong>{retailerToDelete?.retailerName}</strong> (Login ID: {retailerToDelete?.loginId}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRetailer}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Retailer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
