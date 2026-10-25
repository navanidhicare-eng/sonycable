"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Tv, 
  Sparkles, 
  CheckCircle2, 
  Gift, 
  Zap, 
  ShoppingBag, 
  Search, 
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Trash2,
  Loader2,
  ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { AP_LOCATIONS } from "@/lib/apLocations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ConnectionOffer {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  mrp: number;
  offerPrice: number;
  retailerMargin: number;
  features: string[];
  category: "HD" | "Android" | "Multi-TV";
  popular?: boolean;
}

interface ConnectionOrder {
  id: string;
  offerTitle: string;
  offerPrice: number;
  retailerMargin: number;
  customerName: string;
  customerPhone: string;
  retailerId: string;
  shopName: string;
  status: "Pending" | "Installed" | "Cancelled";
  createdAt: any;
}

const DEFAULT_OFFERS: ConnectionOffer[] = [
  {
    id: "offer-1",
    title: "DishTV HD Box + 1 Month Pack",
    subtitle: "Complete New HD Connection with standard dish & installation",
    badge: "BEST SELLER",
    badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    mrp: 1799,
    offerPrice: 1199,
    retailerMargin: 180,
    features: [
      "Full HD 1080p Crystal Clear Quality",
      "Free 1 Month Super Family Pack",
      "Free Dish Antenna + 10m Wire",
      "Standard Installation Included"
    ],
    category: "HD",
    popular: true,
  },
  {
    id: "offer-2",
    title: "DishTV Android Smart Hub STB",
    subtitle: "Convert any TV to Smart TV with Google Assistant & OTT Apps",
    badge: "SMART BUNDLE",
    badgeColor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    mrp: 3499,
    offerPrice: 2499,
    retailerMargin: 350,
    features: [
      "Built-in Chromecast & Voice Remote",
      "Pre-installed Hotstar, SonyLIV, YouTube",
      "4K Ultra HD & Dolby Audio Support"
    ],
    category: "Android",
  },
  {
    id: "offer-3",
    title: "Multi-TV Connection Special",
    subtitle: "Secondary connection offer for 2nd & 3rd TVs in same home",
    badge: "SAVER PACK",
    badgeColor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    mrp: 1299,
    offerPrice: 799,
    retailerMargin: 120,
    features: [
      "50% Discount on 2nd Connection Box",
      "Shared dish antenna setup",
      "Express 24-hour installation"
    ],
    category: "Multi-TV",
  }
];

const offerFormSchema = z.object({
  title: z.string().min(3),
  subtitle: z.string().min(3),
  badge: z.string().default("SPECIAL OFFER"),
  mrp: z.preprocess((a) => Number(a), z.number().min(1)),
  offerPrice: z.preprocess((a) => Number(a), z.number().min(1)),
  retailerMargin: z.preprocess((a) => Number(a), z.number().min(0)),
  category: z.enum(["HD", "Android", "Multi-TV"]),
  featuresRaw: z.string().min(3),
});

export default function NewConnectionOffersPage() {
  const { toast } = useToast();
  const { user, userRole, shopName } = useAuth();
  const [offers, setOffers] = useState<ConnectionOffer[]>([]);
  const [orders, setOrders] = useState<ConnectionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Retailer Book Modal
  const [selectedOffer, setSelectedOffer] = useState<ConnectionOffer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [ncDistrict, setNcDistrict] = useState("");
  const [ncMandal, setNcMandal] = useState("");
  const [ncVillage, setNcVillage] = useState("");
  const [ncLandmark, setNcLandmark] = useState("");
  const [ncScheduledDate, setNcScheduledDate] = useState("");
  const [ncScheduledTime, setNcScheduledTime] = useState("Morning (9 AM - 12 PM)");
  const [bookingLoading, setBookingLoading] = useState(false);

  // Admin Add Offer Dialog
  const [isAdminAddOpen, setIsAdminAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newBadge, setNewBadge] = useState("NEW LAUNCH");
  const [newMrp, setNewMrp] = useState(1999);
  const [newOfferPrice, setNewOfferPrice] = useState(1299);
  const [newMargin, setNewMargin] = useState(200);
  const [newCategory, setNewCategory] = useState<"HD" | "Android" | "Multi-TV">("HD");
  const [newFeaturesText, setNewFeaturesText] = useState("Full HD Quality, Free Installation, 1 Year Warranty");

  // Subscribe to Offers & Orders
  useEffect(() => {
    setLoading(true);

    const offersUnsub = onSnapshot(collection(db, "newConnectionOffers"), async (snapshot) => {
      const isInitialized = typeof window !== "undefined" && localStorage.getItem("nc_offers_initialized") === "true";
      const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("nc_deleted_ids") || "[]") : [];

      if (!snapshot.empty) {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          ...docSnap.data(),
        })) as ConnectionOffer[];

        const filtered = data.filter((o) => !deletedIds.includes(o.id));
        setOffers(filtered);
      } else {
        if (!isInitialized) {
          // Seed default offers into Firestore so they get real documents that can be deleted
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("nc_offers_initialized", "true");
            }
            for (const offer of DEFAULT_OFFERS) {
              await setDoc(doc(db, "newConnectionOffers", offer.id), offer);
            }
          } catch (e) {
            setOffers(DEFAULT_OFFERS.filter((o) => !deletedIds.includes(o.id)));
          }
        } else {
          setOffers([]);
        }
      }
      setLoading(false);
    }, () => {
      const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("nc_deleted_ids") || "[]") : [];
      setOffers(DEFAULT_OFFERS.filter((o) => !deletedIds.includes(o.id)));
      setLoading(false);
    });

    const ordersUnsub = onSnapshot(collection(db, "connectionOrders"), (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ConnectionOrder[];
      setOrders(ordersData);
    });

    return () => {
      offersUnsub();
      ordersUnsub();
    };
  }, []);

  // Admin Add Offer
  const handleAdminAddOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newSubtitle) return;

    setAddLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("nc_offers_initialized", "true");
      }
      const featuresArray = newFeaturesText.split(",").map(f => f.trim()).filter(Boolean);
      await addDoc(collection(db, "newConnectionOffers"), {
        title: newTitle,
        subtitle: newSubtitle,
        badge: newBadge,
        mrp: Number(newMrp),
        offerPrice: Number(newOfferPrice),
        retailerMargin: Number(newMargin),
        category: newCategory,
        features: featuresArray,
        createdAt: new Date(),
      });
      toast({
        title: "Connection Offer Added by Admin!",
        description: `'${newTitle}' published to database.`,
      });
      setIsAdminAddOpen(false);
      setNewTitle("");
      setNewSubtitle("");
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to Add Offer" });
    } finally {
      setAddLoading(false);
    }
  };

  // Admin Delete Offer
  const handleAdminDeleteOffer = async (id: string) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("nc_offers_initialized", "true");
        const deletedIds = JSON.parse(localStorage.getItem("nc_deleted_ids") || "[]");
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          localStorage.setItem("nc_deleted_ids", JSON.stringify(deletedIds));
        }
      }

      // Try deleting from Firestore
      await deleteDoc(doc(db, "newConnectionOffers", id)).catch(() => {});

      // Optimistically filter out from UI
      setOffers((prev) => prev.filter((o) => o.id !== id));
      toast({ title: "Offer Removed Successfully" });
    } catch (err) {
      setOffers((prev) => prev.filter((o) => o.id !== id));
      toast({ title: "Offer Removed" });
    }
  };

  // Admin Update Order Status with Wallet Credit
  const handleUpdateOrderStatus = async (orderId: string, status: "Installed" | "Cancelled", ord?: ConnectionOrder) => {
    try {
      await updateDoc(doc(db, "connectionOrders", orderId), { status, completedAt: Timestamp.now() });
      if (status === "Installed" && ord) {
        // Credit retailer wallet
        try {
          const commSnap = await getDoc(doc(db, "settings", "retailer_commissions"));
          const commRate = commSnap.exists() ? Number(commSnap.data()?.serviceRequestCommission) || 50 : ord.retailerMargin || 50;
          // Find retailer
          const rSnap = await import("firebase/firestore").then(({ getDocs, query, where }) =>
            getDocs(query(collection(db, "dishtv_retailers"), where("uid", "==", ord.retailerId)))
          );
          if (!rSnap.empty) {
            const rDoc = rSnap.docs[0];
            await updateDoc(doc(db, "dishtv_retailers", rDoc.id), {
              walletBalance: (Number(rDoc.data().walletBalance) || 0) + commRate,
              totalEarned: (Number(rDoc.data().totalEarned) || 0) + commRate,
            });
            await addDoc(collection(db, "commission_transactions"), {
              retailerId: rDoc.id,
              retailerUid: ord.retailerId,
              retailerName: rDoc.data().retailerName || ord.shopName || "Retailer",
              retailerMobile: rDoc.data().mobile || "",
              customerName: ord.customerName || "",
              customerMobile: ord.customerPhone || "",
              customerAddress: [(ord as any).village, (ord as any).mandal, (ord as any).district].filter(Boolean).join(", "),
              village: (ord as any).village || "",
              mandal: (ord as any).mandal || "",
              district: (ord as any).district || "",
              amount: commRate,
              type: "Credit",
              category: "New Connection",
              description: `New Connection Installed: ${ord.offerTitle} for ${ord.customerName}`,
              referenceId: ord.id,
              createdAt: Timestamp.now(),
            });
          }
          toast({ title: `✅ Marked Installed & ₹${commRate} Credited to Retailer Wallet!` });
        } catch { toast({ title: `Marked as ${status}` }); }
      } else {
        toast({ title: `Order Marked as ${status}` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  // Retailer Book Connection Order
  const handleBookOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOffer || !customerName || !customerPhone || !ncDistrict || !ncMandal) {
      toast({ variant: "destructive", title: "Please fill all required fields", description: "Name, Mobile, District & Mandal are required." });
      return;
    }

    setBookingLoading(true);
    try {
      const payload = {
        offerTitle: selectedOffer.title,
        offerPrice: selectedOffer.offerPrice,
        retailerMargin: selectedOffer.retailerMargin,
        customerName,
        customerPhone,
        district: ncDistrict,
        mandal: ncMandal,
        village: ncVillage || ncMandal,
        landmark: ncLandmark,
        scheduledDate: ncScheduledDate || new Date().toISOString().split("T")[0],
        scheduledTime: ncScheduledTime,
        retailerId: user?.uid || "unknown",
        requestedByUid: user?.uid || "unknown",
        requestedByName: shopName || "Retailer Partner",
        shopName: shopName || "Retailer Partner",
        status: "Pending",
        createdAt: Timestamp.now(),
      };

      // Save to both collections
      await addDoc(collection(db, "connectionOrders"), payload);
      await addDoc(collection(db, "newConnectionRequests"), {
        ...payload,
        mobile: customerPhone,
      });

      toast({
        title: "New Connection Booked! 📡",
        description: `Order for ${customerName} submitted. Admin & Technician notified.`,
      });
      // Reset
      setCustomerName(""); setCustomerPhone("");
      setNcDistrict(""); setNcMandal(""); setNcVillage(""); setNcLandmark(""); setNcScheduledDate("");
      setNcScheduledTime("Morning (9 AM - 12 PM)");
      setSelectedOffer(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Order Submission Failed" });
    } finally {
      setBookingLoading(false);
    }
  };

  const filteredOffers = offers.filter((offer) => {
    const matchesSearch = offer.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          offer.subtitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || offer.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 p-6 md:p-10 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-md text-amber-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {userRole === 'Admin' ? "Admin Connection Management" : "Retailer Booking Hub"}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              DishTV New Connection Offers
            </h1>
            <p className="text-orange-100 text-sm md:text-base leading-relaxed">
              {userRole === 'Admin'
                ? "Admin Controls: Manage DishTV connection packages & review new installation requests placed by retailers."
                : "Retailer Portal: Book new DishTV HD/Android connections for customers and earn instant margin upon activation."}
            </p>
          </div>
          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
            <Tv className="w-96 h-96 text-white" />
          </div>
        </div>

        {/* Action Header & Tabs */}
        <Tabs defaultValue="offers" className="w-full space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/80 p-4 rounded-xl border border-slate-800 backdrop-blur">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search connection offers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <TabsList className="bg-slate-950 border border-slate-800">
                <TabsTrigger value="offers" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-xs">
                  Connection Packages
                </TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 font-bold text-xs">
                  Customer Orders ({orders.length})
                </TabsTrigger>
              </TabsList>

              {userRole === 'Admin' && (
                <Button
                  onClick={() => setIsAdminAddOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-2 text-xs"
                >
                  <PlusCircle className="w-4 h-4" /> Add Offer (Admin)
                </Button>
              )}
            </div>
          </div>

          {/* Offers Showcase Tab */}
          <TabsContent value="offers" className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["All", "HD", "Android", "Multi-TV"].map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={selectedCategory === cat 
                    ? "bg-amber-500 text-black hover:bg-amber-400 font-bold" 
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"}
                >
                  {cat === "All" ? "All Packages" : `${cat} Boxes`}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => (
                <Card 
                  key={offer.id} 
                  className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between overflow-hidden hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase font-bold">
                        {offer.badge || "NEW"}
                      </Badge>
                      <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                        Retailer Margin: +₹{offer.retailerMargin}
                      </span>
                    </div>
                    <CardTitle className="text-xl font-bold text-white">
                      {offer.title}
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs leading-relaxed">
                      {offer.subtitle}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 flex items-baseline justify-between">
                      <div>
                        <span className="text-xs text-slate-500 line-through mr-2">MRP ₹{offer.mrp}</span>
                        <span className="text-2xl font-black text-amber-400">₹{offer.offerPrice}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Incl. Dish & Cable</span>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300">
                      {offer.features?.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter className="pt-2 flex-col gap-2">
                    {userRole === 'Admin' ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAdminDeleteOffer(offer.id)}
                        className="w-full text-xs font-bold gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Admin Delete Offer
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold hover:from-amber-400 hover:to-orange-400 shadow-md gap-2"
                        onClick={() => setSelectedOffer(offer)}
                      >
                        <ShoppingBag className="w-4 h-4" /> Book New Connection
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Orders Log Tab */}
          <TabsContent value="orders" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                  Submitted Connection Orders
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {userRole === 'Admin'
                    ? "Admin View: Review orders placed by retailers and mark them as Installed."
                    : "Retailer View: Track your submitted customer connection orders."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800">
                      <TableHead className="text-slate-400">Customer</TableHead>
                      <TableHead className="text-slate-400">Package</TableHead>
                      <TableHead className="text-slate-400">Retailer / Shop</TableHead>
                      <TableHead className="text-slate-400">Retailer Margin</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      {userRole === 'Admin' && <TableHead className="text-slate-400">Admin Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length > 0 ? (
                      orders.map((ord) => (
                        <TableRow key={ord.id} className="border-slate-800/60">
                          <TableCell className="font-medium text-white">
                            <div>{ord.customerName}</div>
                            <div className="text-xs text-slate-400">{ord.customerPhone}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">
                            <div>{ord.offerTitle}</div>
                            <div className="text-xs font-bold text-amber-400">₹{ord.offerPrice}</div>
                          </TableCell>
                          <TableCell className="text-slate-300">{ord.shopName || "Retailer"}</TableCell>
                          <TableCell className="font-bold text-emerald-400">+₹{ord.retailerMargin}</TableCell>
                          <TableCell>
                            <Badge 
                              className={ord.status === 'Installed' 
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                                : 'bg-amber-950 text-amber-300 border-amber-800'}
                            >
                              {ord.status || "Pending"}
                            </Badge>
                          </TableCell>
                          {userRole === 'Admin' && (
                            <TableCell className="flex gap-2">
                              {ord.status !== 'Installed' && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleUpdateOrderStatus(ord.id, "Installed", ord)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                >
                                  Mark Installed
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                          No connection orders placed yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Retailer Book Order Dialog Modal */}
        {selectedOffer && (
          <Dialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
            <DialogContent className="bg-slate-900 text-slate-100 border-slate-800 max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-amber-500" />
                  Book: {selectedOffer.title}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Fill all customer details. Admin will receive this on dashboard.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleBookOrder} className="space-y-4 mt-2">
                {/* Offer Summary */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offer Price:</span>
                    <span className="font-bold text-amber-400">₹{selectedOffer.offerPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Your Retailer Margin:</span>
                    <span className="font-bold text-emerald-400">+₹{selectedOffer.retailerMargin}</span>
                  </div>
                </div>

                {/* Customer Name & Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Customer Name *</label>
                    <input
                      placeholder="Enter customer full name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Mobile No *</label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      maxLength={10}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* District / Mandal / Village */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">District *</label>
                    <Select value={ncDistrict} onValueChange={(v) => { setNcDistrict(v); setNcMandal(""); setNcVillage(""); }}>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-48 overflow-y-auto">
                        {AP_LOCATIONS.map((l) => <SelectItem key={l.district} value={l.district}>{l.district}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Mandal *</label>
                    <Select value={ncMandal} onValueChange={(v) => { setNcMandal(v); setNcVillage(""); }} disabled={!ncDistrict}>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-48 overflow-y-auto">
                        {ncDistrict && AP_LOCATIONS.find((l) => l.district === ncDistrict)?.mandals.map((m) => <SelectItem key={m.mandal} value={m.mandal}>{m.mandal}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Village</label>
                    <Select value={ncVillage} onValueChange={setNcVillage} disabled={!ncMandal}>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-48 overflow-y-auto">
                        {ncMandal && AP_LOCATIONS.find((l) => l.district === ncDistrict)?.mandals.find((m) => m.mandal === ncMandal)?.villages.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Landmark */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Landmark / Address Details</label>
                  <input
                    placeholder="e.g. Near Govt School, Opposite temple..."
                    value={ncLandmark}
                    onChange={(e) => setNcLandmark(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Scheduled Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Scheduled Date</label>
                    <input
                      type="date"
                      value={ncScheduledDate}
                      onChange={(e) => setNcScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Time Slot</label>
                    <Select value={ncScheduledTime} onValueChange={setNcScheduledTime}>
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                        <SelectItem value="Morning (9 AM - 12 PM)">🌅 Morning (9 AM - 12 PM)</SelectItem>
                        <SelectItem value="Afternoon (12 PM - 4 PM)">☀️ Afternoon (12 PM - 4 PM)</SelectItem>
                        <SelectItem value="Evening (4 PM - 8 PM)">🌆 Evening (4 PM - 8 PM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold"
                >
                  {bookingLoading ? "Submitting..." : "✅ Confirm & Submit Connection Order"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Admin Add Offer Dialog Modal */}
        {userRole === 'Admin' && (
          <Dialog open={isAdminAddOpen} onOpenChange={setIsAdminAddOpen}>
            <DialogContent className="bg-slate-900 text-slate-100 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-500" />
                  Add DishTV Connection Offer (Admin Only)
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Create a new connection package for all retailers to book.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAdminAddOffer} className="space-y-4 mt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Package Title</label>
                  <Input
                    placeholder="e.g. DishTV HD Box + 6 Months Pack"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Subtitle / Highlight</label>
                  <Input
                    placeholder="e.g. Complete setup with 6 months free HD subscription"
                    value={newSubtitle}
                    onChange={(e) => setNewSubtitle(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">MRP (₹)</label>
                    <Input
                      type="number"
                      value={newMrp}
                      onChange={(e) => setNewMrp(Number(e.target.value))}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Offer Price (₹)</label>
                    <Input
                      type="number"
                      value={newOfferPrice}
                      onChange={(e) => setNewOfferPrice(Number(e.target.value))}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Retailer Margin (₹)</label>
                    <Input
                      type="number"
                      value={newMargin}
                      onChange={(e) => setNewMargin(Number(e.target.value))}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Features (comma separated)</label>
                  <Input
                    placeholder="Full HD 1080p, Free Dish Antenna, 1 Year Warranty"
                    value={newFeaturesText}
                    onChange={(e) => setNewFeaturesText(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={addLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  {addLoading ? "Publishing Package..." : "Publish Connection Offer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </main>
  );
}
