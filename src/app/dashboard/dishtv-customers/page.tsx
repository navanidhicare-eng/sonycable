"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PlusCircle,
  Search,
  Loader2,
  Upload,
  RefreshCw,
  Pencil,
  Trash2,
  Tv,
  Users,
  CheckCircle,
  AlertCircle,
  IndianRupee,
  Calendar,
  CreditCard,
  Store,
  Wrench
} from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  writeBatch,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import Papa from "papaparse";
import { AP_LOCATIONS, CustomLocation, getMergedLocations } from "@/lib/apLocations";

export interface DishTvCustomer {
  id: string;
  name: string;
  mobile: string;
  vcNumber: string;
  subscriberId: string;
  packagePlan: string;
  monthlyAmount: number;
  threeMonthAmount?: number;
  sixMonthAmount?: number;
  twelveMonthAmount?: number;
  district?: string;
  mandal?: string;
  village?: string;
  area?: string;
  status: "Active" | "Expired" | "Suspended";
  lastRechargeDate?: Timestamp | null;
  expiryDate?: Timestamp | null;
  balanceAmount?: number;
  address?: string;
  notes?: string;
  userId: string;
  dealerId?: string;
  dealerName?: string;
  createdByRole?: string;
  createdAt: Timestamp;
}

export interface DishTvDealerOption {
  id: string;
  uid?: string;
  dealerName: string;
  loginId: string;
}

export default function DishTvCustomersPage() {
  const [customers, setCustomers] = useState<DishTvCustomer[]>([]);
  const [dealers, setDealers] = useState<DishTvDealerOption[]>([]);
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterMandal, setFilterMandal] = useState("all");
  const [filterVillage, setFilterVillage] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDealer, setFilterDealer] = useState("all");

  const defaultPackageRates: Record<string, { m: string; t3: string; t6: string; t12: string }> = {
    "sambaralu telugu": { m: "350", t3: "1050", t6: "2100", t12: "4200" },
    "sambaralu telugu HD": { m: "450", t3: "1350", t6: "2700", t12: "5400" },
  };

  const [packageRatesMap, setPackageRatesMap] = useState<
    Record<string, { m: string; t3: string; t6: string; t12: string }>
  >(defaultPackageRates);

  const [packageOptions, setPackageOptions] = useState<{ value: string; label: string }[]>([
    { value: "sambaralu telugu", label: "sambaralu telugu" },
    { value: "sambaralu telugu HD", label: "sambaralu telugu HD" },
  ]);
  const [isCustomPackage, setIsCustomPackage] = useState(false);

  const { toast } = useToast();
  const { user, userRole, loading: authLoading } = useAuth();
  const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
  const isAdmin = user?.email === "psdgandepalli@gmail.com" || userRole === "Admin" || storedRole === "Admin";
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isAddOrEditOpen, setIsAddOrEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<DishTvCustomer | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<DishTvCustomer | null>(null);

  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [rechargeCustomer, setRechargeCustomer] = useState<DishTvCustomer | null>(null);
  const [rechargeMonths, setRechargeMonths] = useState("1");
  const [isRecharging, setIsRecharging] = useState(false);

  // Service Dialog State
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [serviceCustomer, setServiceCustomer] = useState<DishTvCustomer | null>(null);
  const [serviceType, setServiceType] = useState("Cable Shift / Relocation");
  const [serviceAmount, setServiceAmount] = useState("250");
  const [serviceNotes, setServiceNotes] = useState("");
  const [isSavingService, setIsSavingService] = useState(false);

  // Form State with District, Mandal, Village
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    vcNumber: "",
    subscriberId: "",
    packagePlan: "sambaralu telugu",
    monthlyAmount: "350",
    threeMonthAmount: "1050",
    sixMonthAmount: "2100",
    twelveMonthAmount: "4200",
    district: "Anakapalli",
    mandal: "V.Madugula",
    village: "Pothanapudi Agraharam",
    status: "Active" as "Active" | "Expired" | "Suspended",
    expiryDate: "",
    address: "",
    notes: "",
    selectedDealerId: ""
  });

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

  const availableFilterVillages = useMemo(() => {
    if (filterDistrict === "all" || filterMandal === "all") return [];
    const distObj = allLocations.find((d) => d.district === filterDistrict);
    const mandalObj = distObj?.mandals.find((m) => m.mandal === filterMandal);
    return mandalObj ? mandalObj.villages : [];
  }, [allLocations, filterDistrict, filterMandal]);

  // Fetch DishTV Customers, Dealers, Areas, and Packages
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    const isAdminUser = user.email === "psdgandepalli@gmail.com" || storedRole === "Admin" || userRole === "Admin";

    // For Admin: Fetch all customers across all dealers & admin.
    // For Dealer: Fetch customers belonging to this dealer.
    const qCust = isAdminUser
      ? query(collection(db, "dishtv_customers"))
      : query(collection(db, "dishtv_customers"), where("userId", "==", user.uid));

    const unsubscribeCust = onSnapshot(
      qCust,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DishTvCustomer[];

        data.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setCustomers(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching DishTV customers:", error);
        toast({
          variant: "destructive",
          title: "Error loading customers",
          description: "Could not retrieve DishTV customer data.",
        });
        setLoading(false);
      }
    );

    // Fetch Dealers List for Filter Dropdown & Mapping
    const qDealers = query(collection(db, "dishtv_dealers"));
    const unsubscribeDealers = onSnapshot(qDealers, (snapshot) => {
      const dealersData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        uid: docSnap.data().uid,
        dealerName: docSnap.data().dealerName,
        loginId: docSnap.data().loginId,
      })) as DishTvDealerOption[];
      setDealers(dealersData);
    });

    const customLocsQuery = query(collection(db, "custom_locations"), where("userId", "==", user.uid));
    const customLocsUnsubscribe = onSnapshot(customLocsQuery, (snapshot) => {
      const locsData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CustomLocation[];
      setCustomLocations(locsData);
    });

    const packagesQuery = query(collection(db, "packages"), where("userId", "==", user.uid));
    const packagesUnsubscribe = onSnapshot(packagesQuery, (snapshot) => {
      const dbPkgsRates: Record<string, { m: string; t3: string; t6: string; t12: string }> = {};
      const dbPkgs = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const pName = d.packageName;
        const mAmt = d.packageAmount || "350";
        const num = parseFloat(mAmt) || 0;
        dbPkgsRates[pName] = {
          m: String(mAmt),
          t3: d.threeMonthAmount ? String(d.threeMonthAmount) : (num ? String(num * 3) : ""),
          t6: d.sixMonthAmount ? String(d.sixMonthAmount) : (num ? String(num * 6) : ""),
          t12: d.twelveMonthAmount ? String(d.twelveMonthAmount) : (num ? String(num * 12) : ""),
        };
        return { value: pName, label: pName };
      });

      const baseOptions = [
        { value: "sambaralu telugu", label: "sambaralu telugu" },
        { value: "sambaralu telugu HD", label: "sambaralu telugu HD" },
      ];

      dbPkgs.forEach((pkg) => {
        const isSdv = /sdv/i.test(pkg.value);
        if (!isSdv && !baseOptions.some((b) => b.value.toLowerCase() === pkg.value.toLowerCase())) {
          baseOptions.push(pkg);
        }
      });

      setPackageRatesMap({ ...defaultPackageRates, ...dbPkgsRates });
      setPackageOptions(baseOptions);
    });

    return () => {
      unsubscribeCust();
      unsubscribeDealers();
      customLocsUnsubscribe();
      packagesUnsubscribe();
    };
  }, [user, authLoading, toast]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === "Active").length;
    const expired = customers.filter((c) => c.status === "Expired").length;
    const monthlyRev = customers.reduce((sum, c) => sum + (c.monthlyAmount || 0), 0);

    return { total, active, expired, monthlyRev };
  }, [customers]);

  // Helper to determine dealer name for a customer record
  const getDealerForCustomer = (cust: DishTvCustomer) => {
    if (cust.dealerName && cust.dealerName !== "Admin") {
      return cust.dealerName;
    }

    const matchedDealer = dealers.find(
      (d) =>
        (cust.dealerId && (d.id === cust.dealerId || d.uid === cust.dealerId)) ||
        (cust.userId && (d.uid === cust.userId || d.id === cust.userId)) ||
        (cust.dealerName && d.dealerName.toLowerCase() === cust.dealerName.toLowerCase())
    );

    if (matchedDealer) {
      return matchedDealer.dealerName;
    }

    if (cust.createdByRole === "Dealer") {
      return cust.dealerName || "Dealer";
    }

    return null; // Admin created
  };

  // Filtered List
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const term = searchTerm.toLowerCase();
      const dName = getDealerForCustomer(customer);

      const matchesSearch =
        customer.name.toLowerCase().includes(term) ||
        customer.mobile.includes(term) ||
        (customer.vcNumber && customer.vcNumber.toLowerCase().includes(term)) ||
        (customer.subscriberId && customer.subscriberId.toLowerCase().includes(term)) ||
        (customer.district && customer.district.toLowerCase().includes(term)) ||
        (customer.mandal && customer.mandal.toLowerCase().includes(term)) ||
        (customer.village && customer.village.toLowerCase().includes(term)) ||
        (customer.area && customer.area.toLowerCase().includes(term)) ||
        (dName && dName.toLowerCase().includes(term));

      const matchesDistrict = filterDistrict === "all" || customer.district === filterDistrict;
      const matchesMandal = filterMandal === "all" || customer.mandal === filterMandal;
      const matchesVillage = filterVillage === "all" || customer.village === filterVillage || customer.area === filterVillage;
      const matchesStatus = filterStatus === "all" || customer.status === filterStatus;

      const matchesDealer =
        filterDealer === "all"
          ? true
          : filterDealer === "admin"
          ? !dName
          : (() => {
              const selectedDealer = dealers.find((d) => d.id === filterDealer);
              return (
                customer.dealerId === filterDealer ||
                customer.userId === filterDealer ||
                (selectedDealer && dName === selectedDealer.dealerName)
              );
            })();

      return matchesSearch && matchesDistrict && matchesMandal && matchesVillage && matchesStatus && matchesDealer;
    });
  }, [searchTerm, filterDistrict, filterMandal, filterVillage, filterStatus, filterDealer, customers, dealers]);

  // Format Timestamp
  const formatDate = (timestamp?: Timestamp | null) => {
    if (!timestamp) return "N/A";
    try {
      return timestamp.toDate().toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // Check if expiring soon (within 5 days) or expired
  const getStatusBadge = (customer: DishTvCustomer) => {
    if (customer.status === "Suspended") {
      return <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Suspended</Badge>;
    }

    if (!customer.expiryDate) {
      return <Badge variant="outline">Active</Badge>;
    }

    const expDate = customer.expiryDate.toDate();
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0 || customer.status === "Expired") {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (diffDays <= 5) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Expiring in {diffDays}d</Badge>;
    }
    return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Active</Badge>;
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setIsCustomPackage(false);
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);

    const firstDist = allLocations[0]?.district || "Anakapalli";
    const firstMandal = allLocations[0]?.mandals[0]?.mandal || "V.Madugula";
    const firstVillage = allLocations[0]?.mandals[0]?.villages[0] || "Pothanapudi Agraharam";

    setFormData({
      name: "",
      mobile: "",
      vcNumber: "",
      subscriberId: "",
      packagePlan: "sambaralu telugu",
      monthlyAmount: "350",
      threeMonthAmount: "1050",
      sixMonthAmount: "2100",
      twelveMonthAmount: "4200",
      district: firstDist,
      mandal: firstMandal,
      village: firstVillage,
      status: "Active",
      expiryDate: defaultExpiry.toISOString().split("T")[0],
      address: "",
      notes: "",
      selectedDealerId: dealers.length > 0 ? dealers[0].id : "",
    });
    setIsAddOrEditOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (customer: DishTvCustomer) => {
    setEditingCustomer(customer);
    const existingPkg = customer.packagePlan || "sambaralu telugu";
    const isKnown = packageOptions.some((opt) => opt.value === existingPkg);
    setIsCustomPackage(!isKnown);

    const mAmount = customer.monthlyAmount || 0;
    const distVal = customer.district || allLocations[0]?.district || "Anakapalli";
    const mandalVal = customer.mandal || "V.Madugula";
    const villageVal = customer.village || customer.area || "Pothanapudi Agraharam";

    setFormData({
      name: customer.name || "",
      mobile: customer.mobile || "",
      vcNumber: customer.vcNumber || "",
      subscriberId: customer.subscriberId || "",
      packagePlan: existingPkg,
      monthlyAmount: String(mAmount),
      threeMonthAmount: String(customer.threeMonthAmount || (mAmount ? mAmount * 3 : 1050)),
      sixMonthAmount: String(customer.sixMonthAmount || (mAmount ? mAmount * 6 : 2100)),
      twelveMonthAmount: String(customer.twelveMonthAmount || (mAmount ? mAmount * 12 : 4200)),
      district: distVal,
      mandal: mandalVal,
      village: villageVal,
      status: customer.status || "Active",
      expiryDate: customer.expiryDate ? customer.expiryDate.toDate().toISOString().split("T")[0] : "",
      address: customer.address || "",
      notes: customer.notes || "",
      selectedDealerId: customer.dealerId || customer.userId || "",
    });
    setIsAddOrEditOpen(true);
  };

  // Save Customer (Add or Edit)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim() || !formData.mobile.trim() || !formData.vcNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in Customer Name, Mobile Number, and VC Number.",
      });
      return;
    }

    if (isAdmin && !formData.selectedDealerId) {
      toast({
        variant: "destructive",
        title: "Dealer Required",
        description: "Please select a dealer to assign this customer to.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const expiryTimestamp = formData.expiryDate
        ? Timestamp.fromDate(new Date(formData.expiryDate))
        : null;

      const mAmt = parseFloat(formData.monthlyAmount) || 0;
      const t3Amt = parseFloat(formData.threeMonthAmount) || mAmt * 3;
      const t6Amt = parseFloat(formData.sixMonthAmount) || mAmt * 6;
      const t12Amt = parseFloat(formData.twelveMonthAmount) || mAmt * 12;

      const isDealer = !isAdmin;
      const currentDealer = dealers.find((d) => d.uid === user.uid || d.id === user.uid);
      const assignedDealer = dealers.find((d) => d.id === formData.selectedDealerId || d.uid === formData.selectedDealerId);

      const targetDealerId = isDealer ? (currentDealer?.id || user.uid) : (assignedDealer?.id || formData.selectedDealerId);
      const targetDealerName = isDealer ? (currentDealer?.dealerName || "Dealer") : (assignedDealer?.dealerName || "Dealer");
      const targetUserId = isDealer ? user.uid : (assignedDealer?.uid || assignedDealer?.id || user.uid);

      const customerPayload = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        vcNumber: formData.vcNumber.trim(),
        subscriberId: formData.subscriberId.trim(),
        packagePlan: formData.packagePlan.trim(),
        monthlyAmount: mAmt,
        threeMonthAmount: t3Amt,
        sixMonthAmount: t6Amt,
        twelveMonthAmount: t12Amt,
        district: formData.district.trim(),
        mandal: formData.mandal.trim(),
        village: formData.village.trim(),
        area: formData.village.trim() || formData.mandal.trim() || formData.district.trim(),
        status: formData.status,
        expiryDate: expiryTimestamp,
        address: formData.address.trim(),
        notes: formData.notes.trim(),
        dealerId: targetDealerId,
        dealerName: targetDealerName,
        createdByRole: isDealer ? "Dealer" : "Admin",
        userId: targetUserId,
      };

      if (editingCustomer) {
        // Update existing customer
        await updateDoc(doc(db, "dishtv_customers", editingCustomer.id), customerPayload);

        toast({
          title: "Customer Updated",
          description: `Updated ${formData.name}'s DishTV account successfully.`,
        });
      } else {
        // Create new customer
        await addDoc(collection(db, "dishtv_customers"), {
          ...customerPayload,
          lastRechargeDate: Timestamp.now(),
          userId: user.uid,
          createdAt: Timestamp.now(),
        });

        toast({
          title: "Customer Added",
          description: `Added ${formData.name} to DishTV customers list.`,
        });
      }

      setIsAddOrEditOpen(false);
    } catch (error) {
      console.error("Error saving customer:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "An error occurred while saving DishTV customer data.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Quick Recharge Extension
  const getRechargeFee = (customer: DishTvCustomer | null, monthsStr: string) => {
    if (!customer) return 0;
    const m = parseInt(monthsStr, 10);
    if (m === 3) return customer.threeMonthAmount || (customer.monthlyAmount * 3);
    if (m === 6) return customer.sixMonthAmount || (customer.monthlyAmount * 6);
    if (m === 12) return customer.twelveMonthAmount || (customer.monthlyAmount * 12);
    return customer.monthlyAmount || 0;
  };

  const handleOpenRecharge = (customer: DishTvCustomer) => {
    setRechargeCustomer(customer);
    setRechargeMonths("1");
    setIsRechargeDialogOpen(true);
  };

  const handleConfirmRecharge = async () => {
    if (!rechargeCustomer || !user) return;
    setIsRecharging(true);

    try {
      const months = parseInt(rechargeMonths, 10) || 1;
      const currentExpiry = rechargeCustomer.expiryDate ? rechargeCustomer.expiryDate.toDate() : new Date();
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();

      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + months);

      const rechargeAmt = getRechargeFee(rechargeCustomer, rechargeMonths);
      const currentBal = rechargeCustomer.balanceAmount !== undefined
        ? rechargeCustomer.balanceAmount
        : (rechargeCustomer.monthlyAmount || 350);
      const newBal = currentBal + rechargeAmt;

      await updateDoc(doc(db, "dishtv_customers", rechargeCustomer.id), {
        status: "Active",
        lastRechargeDate: Timestamp.now(),
        expiryDate: Timestamp.fromDate(newExpiry),
        balanceAmount: newBal,
      });

      // Save recharge record in dishtv_recharges collection
      await addDoc(collection(db, "dishtv_recharges"), {
        customerId: rechargeCustomer.id,
        customerName: rechargeCustomer.name,
        mobile: rechargeCustomer.mobile,
        months: months,
        amount: rechargeAmt,
        packagePlan: rechargeCustomer.packagePlan || "",
        rechargedAt: Timestamp.now(),
        userId: user.uid,
      });

      toast({
        title: "Recharge Applied!",
        description: `Extended ${rechargeCustomer.name}'s DishTV validity by ${months} month(s) & added ₹${rechargeAmt} to balance. New Balance: ₹${newBal}.`,
      });

      setIsRechargeDialogOpen(false);
    } catch (error) {
      console.error("Recharge error:", error);
      toast({
        variant: "destructive",
        title: "Recharge Failed",
        description: "Failed to update recharge validity.",
      });
    } finally {
      setIsRecharging(false);
    }
  };

  // Service Charge Handlers
  const handleOpenService = (customer: DishTvCustomer) => {
    setServiceCustomer(customer);
    setServiceType("Cable Shift / Relocation");
    setServiceAmount("250");
    setServiceNotes("");
    setIsServiceDialogOpen(true);
  };

  const handleConfirmService = async () => {
    if (!serviceCustomer || !user) return;
    setIsSavingService(true);

    try {
      const addedAmt = parseFloat(serviceAmount) || 0;
      const currentBal = serviceCustomer.balanceAmount !== undefined
        ? serviceCustomer.balanceAmount
        : (serviceCustomer.monthlyAmount || 350);
      const newBal = currentBal + addedAmt;

      // 1. Log service record in dishtv_services
      await addDoc(collection(db, "dishtv_services"), {
        customerId: serviceCustomer.id,
        customerName: serviceCustomer.name,
        mobile: serviceCustomer.mobile,
        serviceType: serviceType,
        amount: addedAmt,
        notes: serviceNotes.trim(),
        addedByUid: user.uid,
        addedByName: user.displayName || user.email || "Dealer",
        createdAt: Timestamp.now(),
      });

      // 2. Update customer balanceAmount
      await updateDoc(doc(db, "dishtv_customers", serviceCustomer.id), {
        balanceAmount: newBal,
      });

      toast({
        title: "Service Charge Added! 🛠️",
        description: `Added ₹${addedAmt} for ${serviceType} to ${serviceCustomer.name}'s balance. New Balance: ₹${newBal}.`,
      });

      setIsServiceDialogOpen(false);
    } catch (err) {
      console.error("Service charge error:", err);
      toast({
        variant: "destructive",
        title: "Service Charge Failed",
        description: "Failed to add service charge.",
      });
    } finally {
      setIsSavingService(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    try {
      await deleteDoc(doc(db, "dishtv_customers", customerToDelete.id));
      toast({
        title: "Customer Deleted",
        description: `${customerToDelete.name} has been removed.`,
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Could not delete DishTV customer.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  // Bulk CSV Upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const required = ["name", "mobile", "vcNumber"];
        const headers = results.meta.fields || [];
        const missing = required.filter((r) => !headers.includes(r));

        if (missing.length > 0) {
          toast({
            variant: "destructive",
            title: "Invalid CSV Format",
            description: `Missing required headers: ${missing.join(", ")}`,
          });
          setIsUploading(false);
          return;
        }

        const rows = results.data as any[];

        try {
          const batch = writeBatch(db);
          rows.forEach((row) => {
            const ref = doc(collection(db, "dishtv_customers"));
            const expDate = row.expiryDate ? new Date(row.expiryDate) : new Date(Date.now() + 30 * 86400000);

            batch.set(ref, {
              name: row.name || "Unknown",
              mobile: row.mobile || "",
              vcNumber: row.vcNumber || "",
              subscriberId: row.subscriberId || "",
              packagePlan: row.packagePlan || "DishTV South Family HD",
              monthlyAmount: parseFloat(row.monthlyAmount) || 350,
              area: row.area || "Default",
              status: row.status === "Expired" ? "Expired" : "Active",
              lastRechargeDate: Timestamp.now(),
              expiryDate: Timestamp.fromDate(expDate),
              address: row.address || "",
              notes: row.notes || "",
              userId: user.uid,
              createdAt: Timestamp.now(),
            });
          });

          await batch.commit();

          toast({
            title: "Bulk Upload Success",
            description: `Imported ${rows.length} DishTV customers.`,
          });
        } catch (error) {
          console.error("Bulk upload error:", error);
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to import CSV data into Firebase.",
          });
        } finally {
          setIsUploading(false);
          setIsUploadDialogOpen(false);
        }
      },
      error: (err) => {
        toast({
          variant: "destructive",
          title: "CSV Parse Error",
          description: err.message,
        });
        setIsUploading(false);
      },
    });
  };

  const generateCsvTemplate = () => {
    const content =
      "name,mobile,vcNumber,subscriberId,packagePlan,monthlyAmount,area,status,expiryDate,address\n" +
      "Ramesh Kumar,9876543210,01523456789,DISH998877,DishTV South Family HD,350,Main Road,Active,2026-09-30,H.No 1-2-3\n";

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", "dishtv_customers_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sync Customer Areas into Areas Collection
  const handleSyncAreas = async () => {
    if (!user) return;
    setIsSyncing(true);

    try {
      const customerAreas = new Set(customers.map((c) => (c.area || "").trim()).filter(Boolean));
      const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
      const snap = await getDocs(areasQuery);
      const existing = new Set(snap.docs.map((d) => d.data().name.trim()));

      const newAreas = [...customerAreas].filter((a) => !existing.has(a));

      if (newAreas.length === 0) {
        toast({ title: "Areas Synced", description: "All areas are up to date." });
        return;
      }

      const batch = writeBatch(db);
      newAreas.forEach((areaName) => {
        const ref = doc(collection(db, "areas"));
        batch.set(ref, {
          name: areaName,
          description: "Auto-synced from DishTV Customers",
          createdAt: new Date(),
          userId: user.uid,
        });
      });

      await batch.commit();

      toast({
        title: "Sync Complete",
        description: `Added ${newAreas.length} new area(s) from DishTV customers.`,
      });
    } catch (err) {
      console.error("Area sync error:", err);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: "Failed to sync areas.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/20">
      <div className="container mx-auto p-4 py-8 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Tv className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">DishTV Customers</h1>
                <p className="text-muted-foreground mt-1">
                  Manage DishTV subscriptions, VC numbers, package renewals, and customer details.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSyncAreas} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync Areas
            </Button>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Upload DishTV Customers</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file with customer name, mobile, VC number, etc.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Required fields: <code className="bg-muted px-1 py-0.5 rounded">name</code>, <code className="bg-muted px-1 py-0.5 rounded">mobile</code>, <code className="bg-muted px-1 py-0.5 rounded">vcNumber</code>
                  </p>
                  <Button variant="link" onClick={generateCsvTemplate} className="p-0 h-auto">
                    Download CSV Template
                  </Button>
                  <Input type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading} />
                  {isUploading && (
                    <div className="flex items-center text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Uploading customer data...</span>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={handleOpenAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add DishTV Customer
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
                <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
              </div>
              <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                <h3 className="text-2xl font-bold mt-1 text-emerald-600">{stats.active}</h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-lg text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expired / Due</p>
                <h3 className="text-2xl font-bold mt-1 text-amber-600">{stats.expired}</h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                <h3 className="text-2xl font-bold mt-1 text-blue-600">₹{stats.monthlyRev.toLocaleString()}</h3>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-600">
                <IndianRupee className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Table Section */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>DishTV Subscriber Directory</CardTitle>
                <CardDescription className="mt-1">
                  Showing {filteredCustomers.length} of {customers.length} customer records
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by Name, VC, Mobile..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                {isAdmin && (
                  <Select value={filterDealer} onValueChange={setFilterDealer}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Filter Dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dealers & Admin</SelectItem>
                      <SelectItem value="admin">Admin Created Only</SelectItem>
                      {dealers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.dealerName} ({d.loginId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filterDistrict} onValueChange={(val) => {
                  setFilterDistrict(val);
                  setFilterMandal("all");
                  setFilterVillage("all");
                }}>
                  <SelectTrigger className="w-full sm:w-40">
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

                {filterDistrict !== "all" && (
                  <Select value={filterMandal} onValueChange={(val) => {
                    setFilterMandal(val);
                    setFilterVillage("all");
                  }}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Mandal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Mandals</SelectItem>
                      {(allLocations.find((d) => d.district === filterDistrict)?.mandals || []).map((m) => (
                        <SelectItem key={m.mandal} value={m.mandal}>
                          {m.mandal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {filterMandal !== "all" && (
                  <Select value={filterVillage} onValueChange={setFilterVillage}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Village" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Villages</SelectItem>
                      {availableFilterVillages.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading || authLoading ? (
              <div className="flex justify-center items-center py-20 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                <span>Loading DishTV customer directory...</span>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Customer Info</TableHead>
                      <TableHead>VC Number / Subscriber ID</TableHead>
                      <TableHead>Package / Plan</TableHead>
                      <TableHead>Location (Village / Mandal)</TableHead>
                      <TableHead>Monthly Fee</TableHead>
                      {isAdmin && <TableHead>Dealer / Created By</TableHead>}
                      <TableHead>Validity Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((cust) => (
                        <TableRow key={cust.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{cust.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{cust.mobile}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-mono text-sm font-medium text-primary">{cust.vcNumber}</div>
                              {cust.subscriberId && (
                                <div className="text-xs text-muted-foreground">ID: {cust.subscriberId}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{cust.packagePlan}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {cust.village || cust.area || "N/A"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {[cust.mandal, cust.district].filter(Boolean).join(", ")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-semibold text-foreground">₹{cust.monthlyAmount} / mo</span>
                              <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">
                                3m: ₹{(cust.threeMonthAmount || (cust.monthlyAmount || 0) * 3).toLocaleString()} | 6m: ₹{(cust.sixMonthAmount || (cust.monthlyAmount || 0) * 6).toLocaleString()} | 12m: ₹{(cust.twelveMonthAmount || (cust.monthlyAmount || 0) * 12).toLocaleString()}
                              </div>
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {(() => {
                                const dName = getDealerForCustomer(cust);
                                if (dName) {
                                  return (
                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/60 font-medium">
                                      <Store className="h-3 w-3 mr-1 text-blue-600" />
                                      {dName}
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/5 font-medium">
                                    Admin
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="space-y-1">
                              {getStatusBadge(cust)}
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="h-3 w-3" />
                                Exp: {formatDate(cust.expiryDate)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRecharge(cust)}
                                className="h-8 px-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1" />
                                Recharge
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenService(cust)}
                                className="h-8 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              >
                                <Wrench className="h-3.5 w-3.5 mr-1" />
                                Service
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleOpenEdit(cust)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setCustomerToDelete(cust);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          No DishTV customers found. Click "Add DishTV Customer" to get started!
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

      {/* Add / Edit Dialog */}
      <Dialog open={isAddOrEditOpen} onOpenChange={setIsAddOrEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit DishTV Customer" : "Add New DishTV Customer"}</DialogTitle>
            <DialogDescription>
              Fill in customer details, DishTV VC number, package, and validity.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCustomer} className="space-y-4 py-2">
            {isAdmin && (
              <div className="space-y-2 p-3 bg-blue-500/5 rounded-lg border border-blue-200/50">
                <Label htmlFor="dealerSelect" className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-blue-600" />
                  Assign to Dealer *
                </Label>
                <Select
                  value={formData.selectedDealerId}
                  onValueChange={(val) => setFormData({ ...formData, selectedDealerId: val })}
                >
                  <SelectTrigger id="dealerSelect" className="bg-background border-blue-200">
                    <SelectValue placeholder="-- Select Dealer --" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.dealerName} ({d.loginId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Customer Full Name *</Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number *</Label>
                <Input
                  id="mobile"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vcNumber">DishTV VC / Smart Card No *</Label>
                <Input
                  id="vcNumber"
                  required
                  placeholder="e.g. 01523456789"
                  value={formData.vcNumber}
                  onChange={(e) => setFormData({ ...formData, vcNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriberId">DishTV Subscriber ID</Label>
                <Input
                  id="subscriberId"
                  placeholder="e.g. DISH998877"
                  value={formData.subscriberId}
                  onChange={(e) => setFormData({ ...formData, subscriberId: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="packagePlanSelect">Package / Channel Pack</Label>
              <Select
                value={
                  isCustomPackage
                    ? "custom"
                    : packageOptions.some((opt) => opt.value === formData.packagePlan)
                    ? formData.packagePlan
                    : "sambaralu telugu"
                }
                onValueChange={(val) => {
                  if (val === "custom") {
                    setIsCustomPackage(true);
                    setFormData({ ...formData, packagePlan: "" });
                  } else {
                    setIsCustomPackage(false);
                    const rates = packageRatesMap[val] || defaultPackageRates[val] || {
                      m: "350",
                      t3: "1050",
                      t6: "2100",
                      t12: "4200",
                    };
                    setFormData({
                      ...formData,
                      packagePlan: val,
                      monthlyAmount: rates.m,
                      threeMonthAmount: rates.t3,
                      sixMonthAmount: rates.t6,
                      twelveMonthAmount: rates.t12,
                    });
                  }
                }}
              >
                <SelectTrigger id="packagePlanSelect">
                  <SelectValue placeholder="Select Package" />
                </SelectTrigger>
                <SelectContent>
                  {packageOptions.map((opt, idx) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {idx + 1}. {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Other / Custom Package</SelectItem>
                </SelectContent>
              </Select>

              {isCustomPackage && (
                <Input
                  placeholder="Enter custom package name..."
                  value={formData.packagePlan}
                  onChange={(e) => setFormData({ ...formData, packagePlan: e.target.value })}
                  className="mt-2"
                />
              )}
            </div>

            {/* Multi-month Amount Rates */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recharge Amount Rates (₹)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-muted/30 rounded-lg border">
                <div>
                  <Label htmlFor="monthlyAmount" className="text-xs text-muted-foreground">1 Month (₹)</Label>
                  <Input
                    id="monthlyAmount"
                    type="number"
                    placeholder="350"
                    value={formData.monthlyAmount}
                    onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })}
                    className="mt-1 bg-background text-sm h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="threeMonthAmount" className="text-xs text-muted-foreground">3 Months (₹)</Label>
                  <Input
                    id="threeMonthAmount"
                    type="number"
                    placeholder="1050"
                    value={formData.threeMonthAmount}
                    onChange={(e) => setFormData({ ...formData, threeMonthAmount: e.target.value })}
                    className="mt-1 bg-background text-sm h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="sixMonthAmount" className="text-xs text-muted-foreground">6 Months (₹)</Label>
                  <Input
                    id="sixMonthAmount"
                    type="number"
                    placeholder="2100"
                    value={formData.sixMonthAmount}
                    onChange={(e) => setFormData({ ...formData, sixMonthAmount: e.target.value })}
                    className="mt-1 bg-background text-sm h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="twelveMonthAmount" className="text-xs text-muted-foreground">12 Months (₹)</Label>
                  <Input
                    id="twelveMonthAmount"
                    type="number"
                    placeholder="4200"
                    value={formData.twelveMonthAmount}
                    onChange={(e) => setFormData({ ...formData, twelveMonthAmount: e.target.value })}
                    className="mt-1 bg-background text-sm h-9"
                  />
                </div>
              </div>
            </div>

            {/* Cascading Location: District -> Mandal -> Village */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Customer Location (District / Mandal / Village)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/20 rounded-lg border">
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
                    <SelectTrigger id="district" className="bg-background text-sm h-9">
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
                    <SelectTrigger id="mandal" className="bg-background text-sm h-9">
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
                    <SelectTrigger id="village" className="bg-background text-sm h-9">
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

            <div className="space-y-2">
              <Label htmlFor="status">Subscription Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val: "Active" | "Expired" | "Suspended") =>
                  setFormData({ ...formData, status: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate">Next Recharge Due / Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address / Notes</Label>
              <Input
                id="address"
                placeholder="House no, landmark, or internal notes"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" type="button" onClick={() => setIsAddOrEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCustomer ? "Update Customer" : "Save Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Recharge Dialog */}
      <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Recharge DishTV Subscription
            </DialogTitle>
            <DialogDescription>
              Renew and extend validity for <strong>{rechargeCustomer?.name}</strong> (VC: {rechargeCustomer?.vcNumber}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Plan:</span>
                <span className="font-semibold">{rechargeCustomer?.packagePlan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Fee:</span>
                <span className="font-semibold">₹{rechargeCustomer?.monthlyAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Expiry:</span>
                <span className="font-semibold">{formatDate(rechargeCustomer?.expiryDate)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Recharge Duration</Label>
              <Select value={rechargeMonths} onValueChange={setRechargeMonths}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">
                    1 Month (30 Days) - ₹{rechargeCustomer?.monthlyAmount || 0}
                  </SelectItem>
                  <SelectItem value="3">
                    3 Months (90 Days) - ₹{rechargeCustomer?.threeMonthAmount || (rechargeCustomer?.monthlyAmount || 0) * 3}
                  </SelectItem>
                  <SelectItem value="6">
                    6 Months (180 Days) - ₹{rechargeCustomer?.sixMonthAmount || (rechargeCustomer?.monthlyAmount || 0) * 6}
                  </SelectItem>
                  <SelectItem value="12">
                    1 Year (365 Days) - ₹{rechargeCustomer?.twelveMonthAmount || (rechargeCustomer?.monthlyAmount || 0) * 12}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRechargeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRecharge}
              disabled={isRecharging}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isRecharging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Recharge (₹{getRechargeFee(rechargeCustomer, rechargeMonths).toLocaleString()})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Extra Service Charge Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Wrench className="h-5 w-5 text-blue-600" />
              Add Extra Service Charge
            </DialogTitle>
            <DialogDescription>
              Add service charges for <strong>{serviceCustomer?.name}</strong> (Mobile: {serviceCustomer?.mobile}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="serviceTypeSelect" className="text-sm font-medium">Select Service Type *</Label>
              <Select
                value={serviceType}
                onValueChange={(val) => {
                  setServiceType(val);
                  if (val === "Cable Shift / Relocation") setServiceAmount("250");
                  else if (val === "Wire / Cable Replacement") setServiceAmount("200");
                  else if (val === "New Connection Charge") setServiceAmount("500");
                  else if (val === "STB Repair / Replacement") setServiceAmount("300");
                  else if (val === "Remote Replacement") setServiceAmount("150");
                  else if (val === "Dish Tuning & Alignment") setServiceAmount("150");
                  else setServiceAmount("200");
                }}
              >
                <SelectTrigger id="serviceTypeSelect" className="bg-background">
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cable Shift / Relocation">🔌 Cable Shift / Relocation (₹250)</SelectItem>
                  <SelectItem value="Wire / Cable Replacement">🔌 Wire / Cable Replacement (₹200)</SelectItem>
                  <SelectItem value="New Connection Charge">📡 New Connection Charge (₹500)</SelectItem>
                  <SelectItem value="STB Repair / Replacement">📦 STB Repair / Replacement (₹300)</SelectItem>
                  <SelectItem value="Remote Replacement">🎮 Remote Replacement (₹150)</SelectItem>
                  <SelectItem value="Dish Tuning & Alignment">🛰️ Dish Tuning & Alignment (₹150)</SelectItem>
                  <SelectItem value="Other Service Charge">🛠️ Other Service Charge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceAmountInput" className="text-sm font-medium">Service Amount (₹) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">₹</span>
                <Input
                  id="serviceAmountInput"
                  type="number"
                  value={serviceAmount}
                  onChange={(e) => setServiceAmount(e.target.value)}
                  className="pl-8 text-lg font-bold text-blue-600 bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceNotesInput" className="text-sm font-medium">Notes / Description (Optional)</Label>
              <Input
                id="serviceNotesInput"
                placeholder="e.g. Changed 10 meters wire or replaced remote"
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmService}
              disabled={isSavingService || !serviceAmount}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSavingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Service Charge (₹{parseFloat(serviceAmount || "0").toLocaleString()})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DishTV Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer account for{" "}
              <strong>{customerToDelete?.name}</strong> (VC: {customerToDelete?.vcNumber}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCustomer}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
