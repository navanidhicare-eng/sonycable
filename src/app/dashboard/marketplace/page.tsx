"use client";

import { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Tv, 
  CheckCircle2, 
  Search, 
  Plus, 
  Minus, 
  Truck, 
  Package, 
  Sparkles,
  ShieldCheck,
  PlusCircle,
  Trash2,
  Loader2,
  ClipboardList,
  Image as ImageIcon
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
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";

interface Product {
  id: string;
  name: string;
  category: "Remotes" | "Cables" | "Adapters" | "LNB" | "Accessories";
  wholesalePrice: number;
  mrp: number;
  minQuantity: number;
  description: string;
  inStock: boolean;
  badge?: string;
  imageUrl?: string;
}

interface MarketplaceOrder {
  id: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  retailerId: string;
  shopName: string;
  status: "Pending" | "Dispatched" | "Delivered";
  createdAt: any;
}

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "p-1",
    name: "DishTV Universal HD Smart Remote Control",
    category: "Remotes",
    wholesalePrice: 95,
    mrp: 250,
    minQuantity: 10,
    description: "Compatible with all DishTV HD & SD Set-Top Boxes. Learning remote buttons included.",
    inStock: true,
    badge: "FAST SELLER",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "p-2",
    name: "RG6 Coaxial Cable Roll (90 Meters, 100% Copper)",
    category: "Cables",
    wholesalePrice: 850,
    mrp: 1499,
    minQuantity: 2,
    description: "Heavy-duty outdoor coaxial cable for crystal-clear satellite signal transmission.",
    inStock: true,
    badge: "BULK SAVER",
    imageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "p-3",
    name: "DishTV 12V 1.5A Power Adapter",
    category: "Adapters",
    wholesalePrice: 110,
    mrp: 299,
    minQuantity: 5,
    description: "High-grade surge protected power supply adapter for HD Set-Top Boxes.",
    inStock: true,
    imageUrl: "https://images.unsplash.com/photo-1601524909162-ae8725290836?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "p-4",
    name: "Single Ku-Band LNB (High Gain 0.1dB)",
    category: "LNB",
    wholesalePrice: 140,
    mrp: 350,
    minQuantity: 5,
    description: "Weather-proof satellite reception head unit for maximum signal strength.",
    inStock: true,
    badge: "HIGH GAIN",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
  }
];

export default function MarketplacePage() {
  const { toast } = useToast();
  const { user, userRole, shopName } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Retailer Order Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [orderLoading, setOrderLoading] = useState(false);

  // Admin Add Product Dialog
  const [isAdminAddOpen, setIsAdminAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState<"Remotes" | "Cables" | "Adapters" | "LNB" | "Accessories">("Remotes");
  const [prodWholesalePrice, setProdWholesalePrice] = useState(95);
  const [prodMrp, setProdMrp] = useState(250);
  const [prodMinQty, setProdMinQty] = useState(5);
  const [prodDesc, setProdDesc] = useState("Original DishTV spare accessory.");
  const [prodBadge, setProdBadge] = useState("NEW ITEM");
  const [prodImageUrl, setProdImageUrl] = useState("");

  useEffect(() => {
    setLoading(true);

    const prodUnsub = onSnapshot(collection(db, "marketplaceProducts"), async (snapshot) => {
      const isInitialized = typeof window !== "undefined" && localStorage.getItem("mk_products_initialized") === "true";
      const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("mk_deleted_ids") || "[]") : [];

      if (!snapshot.empty) {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          inStock: true,
          ...docSnap.data(),
        })) as Product[];

        const filtered = data.filter((p) => !deletedIds.includes(p.id));
        setProducts(filtered);
      } else {
        if (!isInitialized) {
          // Seed default products into Firestore so they get real documents that can be deleted
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("mk_products_initialized", "true");
            }
            for (const prod of DEFAULT_PRODUCTS) {
              await setDoc(doc(db, "marketplaceProducts", prod.id), prod);
            }
          } catch (e) {
            setProducts(DEFAULT_PRODUCTS.filter((p) => !deletedIds.includes(p.id)));
          }
        } else {
          setProducts([]);
        }
      }
      setLoading(false);
    }, () => {
      const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("mk_deleted_ids") || "[]") : [];
      setProducts(DEFAULT_PRODUCTS.filter((p) => !deletedIds.includes(p.id)));
      setLoading(false);
    });

    const ordersUnsub = onSnapshot(collection(db, "marketplaceOrders"), (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketplaceOrder[];
      setOrders(ordersData);
    });

    return () => {
      prodUnsub();
      ordersUnsub();
    };
  }, []);

  // Admin Add Product
  const handleAdminAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName) return;

    setAddLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("mk_products_initialized", "true");
      }
      const finalImage = prodImageUrl.trim() || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80";

      await addDoc(collection(db, "marketplaceProducts"), {
        name: prodName,
        category: prodCategory,
        wholesalePrice: Number(prodWholesalePrice),
        mrp: Number(prodMrp),
        minQuantity: Number(prodMinQty),
        description: prodDesc,
        badge: prodBadge,
        imageUrl: finalImage,
        inStock: true,
        createdAt: new Date(),
      });
      toast({
        title: "Product Added to Marketplace!",
        description: `'${prodName}' is live with image for all retailers.`,
      });
      setIsAdminAddOpen(false);
      setProdName("");
      setProdImageUrl("");
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to Add Product" });
    } finally {
      setAddLoading(false);
    }
  };

  // Admin Delete Product
  const handleAdminDeleteProduct = async (id: string) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("mk_products_initialized", "true");
        const deletedIds = JSON.parse(localStorage.getItem("mk_deleted_ids") || "[]");
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          localStorage.setItem("mk_deleted_ids", JSON.stringify(deletedIds));
        }
      }

      // Try deleting from Firestore
      await deleteDoc(doc(db, "marketplaceProducts", id)).catch(() => {});

      // Optimistically filter out from UI
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Product Removed Successfully" });
    } catch (err) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Product Removed" });
    }
  };

  // Admin Update Order Status
  const handleUpdateOrderStatus = async (orderId: string, status: "Dispatched" | "Delivered") => {
    try {
      await updateDoc(doc(db, "marketplaceOrders", orderId), { status });
      toast({ title: `Order Marked as ${status}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  // Retailer Submit Stock Order
  const handlePlaceStockOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setOrderLoading(true);
    try {
      const totalPrice = selectedProduct.wholesalePrice * quantity;
      await addDoc(collection(db, "marketplaceOrders"), {
        productName: selectedProduct.name,
        quantity,
        totalPrice,
        retailerId: user?.uid || "unknown",
        shopName: shopName || "Retailer Partner",
        status: "Pending",
        createdAt: new Date(),
      });

      toast({
        title: "Wholesale Stock Order Submitted!",
        description: `Ordered ${quantity}x ${selectedProduct.name}. Admin will dispatch your order.`,
      });
      setSelectedProduct(null);
    } catch (err) {
      toast({ variant: "destructive", title: "Order Submission Failed" });
    } finally {
      setOrderLoading(false);
    }
  };

  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          prod.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || prod.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen w-full bg-slate-950 text-slate-100 p-3 sm:p-6 md:p-8 font-sans pb-16">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
        
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 p-4 sm:p-6 md:p-10 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-2 sm:space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/30 backdrop-blur-md text-cyan-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
              {userRole === 'Admin' ? "Admin Wholesale Store Management" : "Retailer Accessories Store"}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tight">
              Retailer B2B Marketplace
            </h1>
            <p className="text-cyan-100 text-xs sm:text-sm md:text-base leading-relaxed">
              {userRole === 'Admin'
                ? "Admin Controls: Add spare accessories with images to catalog & manage bulk stock order requests."
                : "Retailer Portal: Order DishTV remotes, RG6 cables, LNBFs, and adapters directly at wholesale prices."}
            </p>
          </div>
          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none hidden sm:flex items-center justify-center">
            <ShoppingBag className="w-72 h-72 sm:w-96 sm:h-96 text-white" />
          </div>
        </div>

        {/* Action Header & Tabs */}
        <Tabs defaultValue="products" className="w-full space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-slate-800 backdrop-blur">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search accessories or cables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-cyan-500 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <TabsList className="bg-slate-950 border border-slate-800 h-9">
                <TabsTrigger value="products" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 font-bold text-[11px] sm:text-xs">
                  Products
                </TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 font-bold text-[11px] sm:text-xs">
                  Orders ({orders.length})
                </TabsTrigger>
              </TabsList>

              {userRole === 'Admin' && (
                <Button
                  onClick={() => setIsAdminAddOpen(true)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold gap-1.5 text-xs h-9"
                >
                  <PlusCircle className="w-4 h-4" /> Add Product
                </Button>
              )}
            </div>
          </div>

          {/* Products Catalog Tab */}
          <TabsContent value="products" className="space-y-4 sm:space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {["All", "Remotes", "Cables", "Adapters", "LNB", "Accessories"].map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className={selectedCategory === cat 
                    ? "bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs h-8" 
                    : "border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"}
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* 2 PRODUCTS SIDE-BY-SIDE ON MOBILE (grid-cols-2) */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-6">
              {filteredProducts.map((prod) => (
                <Card 
                  key={prod.id} 
                  className="bg-slate-900 border-slate-800 text-slate-100 flex flex-col justify-between overflow-hidden hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  {/* Product Image Section */}
                  <div className="relative w-full h-28 sm:h-44 bg-slate-950 overflow-hidden border-b border-slate-800 flex items-center justify-center group">
                    {prod.imageUrl ? (
                      <img 
                        src={prod.imageUrl} 
                        alt={prod.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 gap-1 p-2">
                        <Package className="w-8 h-8 text-cyan-500/50" />
                        <span className="text-[10px] text-slate-500">DishTV Accessory</span>
                      </div>
                    )}
                    {prod.badge && (
                      <Badge className="absolute top-2 left-2 bg-cyan-500 text-slate-950 font-black text-[9px] sm:text-[10px] uppercase shadow-md px-1.5 py-0.5">
                        {prod.badge}
                      </Badge>
                    )}
                    <Badge className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur text-slate-300 border border-slate-700 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                      Min: {prod.minQuantity}
                    </Badge>
                  </div>

                  <CardHeader className="p-2.5 sm:p-4 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="text-cyan-400 font-semibold uppercase">{prod.category}</span>
                    </div>

                    <CardTitle className="text-xs sm:text-base font-bold text-white leading-snug line-clamp-2">
                      {prod.name}
                    </CardTitle>

                    <CardDescription className="text-slate-400 text-[10px] sm:text-xs leading-tight line-clamp-2 hidden sm:block">
                      {prod.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-2.5 sm:p-4 pt-0 space-y-2 flex-1">
                    <div className="bg-slate-950 p-2 sm:p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <div>
                        <span className="text-[10px] sm:text-xs text-slate-500 block">MRP: ₹{prod.mrp}</span>
                        <span className="text-sm sm:text-xl font-black text-cyan-400">₹{prod.wholesalePrice}</span>
                      </div>
                      <span className="text-[9px] sm:text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 w-fit">
                        Profit: ₹{prod.mrp - prod.wholesalePrice}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-2.5 sm:p-4 pt-0 flex-col gap-2">
                    {userRole === 'Admin' ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAdminDeleteProduct(prod.id)}
                        className="w-full text-[10px] sm:text-xs font-bold gap-1 h-8"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold hover:from-cyan-400 hover:to-blue-400 shadow-md gap-1 sm:gap-2 text-[11px] sm:text-xs h-8 sm:h-10 px-2"
                        onClick={() => {
                          setSelectedProduct(prod);
                          setQuantity(prod.minQuantity || 5);
                        }}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Order Stock
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
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg font-bold text-cyan-400 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-cyan-500" />
                  Wholesale Stock Orders
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {userRole === 'Admin'
                    ? "Admin View: Review stock orders placed by retailers and mark them as Dispatched."
                    : "Retailer View: Track your ordered wholesale stock requests."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 sm:pt-0">
                {/* Mobile View: Cards */}
                <div className="block sm:hidden space-y-3">
                  {orders.length > 0 ? (
                    orders.map((ord) => (
                      <div key={ord.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-white text-xs block">{ord.productName}</span>
                            <span className="text-[10px] text-slate-400">Shop: {ord.shopName || "Retailer"}</span>
                          </div>
                          <Badge 
                            className={ord.status === 'Dispatched' || ord.status === 'Delivered'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]' 
                              : 'bg-cyan-950 text-cyan-300 border-cyan-800 text-[10px]'}
                          >
                            {ord.status || "Pending"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                          <div>
                            <span className="text-[10px] text-slate-400">Qty: </span>
                            <strong className="text-cyan-400 font-mono">{ord.quantity} pcs</strong>
                            <span className="mx-1 text-slate-600">|</span>
                            <span className="text-[10px] text-slate-400">Total: </span>
                            <strong className="text-white font-mono">₹{ord.totalPrice}</strong>
                          </div>
                          {userRole === 'Admin' && ord.status !== 'Dispatched' && ord.status !== 'Delivered' && (
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateOrderStatus(ord.id, "Dispatched")}
                              className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold h-7 px-2"
                            >
                              Mark Dispatched
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-6 text-xs text-slate-500">No wholesale stock orders placed yet.</p>
                  )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800">
                        <TableHead className="text-slate-400">Product</TableHead>
                        <TableHead className="text-slate-400">Qty</TableHead>
                        <TableHead className="text-slate-400">Total Price</TableHead>
                        <TableHead className="text-slate-400">Retailer / Shop</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        {userRole === 'Admin' && <TableHead className="text-slate-400">Admin Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length > 0 ? (
                        orders.map((ord) => (
                          <TableRow key={ord.id} className="border-slate-800/60">
                            <TableCell className="font-medium text-white">{ord.productName}</TableCell>
                            <TableCell className="text-cyan-400 font-bold">{ord.quantity} pcs</TableCell>
                            <TableCell className="font-bold text-white">₹{ord.totalPrice}</TableCell>
                            <TableCell className="text-slate-300">{ord.shopName || "Retailer"}</TableCell>
                            <TableCell>
                              <Badge 
                                className={ord.status === 'Dispatched' || ord.status === 'Delivered'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                                  : 'bg-cyan-950 text-cyan-300 border-cyan-800'}
                              >
                                {ord.status || "Pending"}
                              </Badge>
                            </TableCell>
                            {userRole === 'Admin' && (
                              <TableCell className="flex gap-2">
                                {ord.status !== 'Dispatched' && ord.status !== 'Delivered' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateOrderStatus(ord.id, "Dispatched")}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                                  >
                                    Mark Dispatched
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                            No wholesale stock orders placed yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Retailer Order Stock Modal */}
        {selectedProduct && (
          <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
            <DialogContent className="bg-slate-900 text-slate-100 border-slate-800 max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl font-bold text-cyan-400 flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-500" />
                  Order Stock: {selectedProduct.name}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Enter quantity to order stock at wholesale prices.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handlePlaceStockOrder} className="space-y-4 mt-2">
                {/* Product Image Preview in Dialog */}
                {selectedProduct.imageUrl && (
                  <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
                    <img 
                      src={selectedProduct.imageUrl} 
                      alt={selectedProduct.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Wholesale Price / Unit:</span>
                    <span className="font-bold text-cyan-400">₹{selectedProduct.wholesalePrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Minimum Order Qty:</span>
                    <span className="font-bold text-slate-200">{selectedProduct.minQuantity} pcs</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Quantity (units)</label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(selectedProduct.minQuantity || 1, quantity - 5))}
                      className="border-slate-700 bg-slate-950 text-slate-200"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(selectedProduct.minQuantity || 1, Number(e.target.value)))}
                      className="bg-slate-950 border-slate-700 text-center font-bold text-cyan-400 text-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(quantity + 5)}
                      className="border-slate-700 bg-slate-950 text-slate-200"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-cyan-950/40 p-3 rounded-lg border border-cyan-800/60 flex justify-between items-center text-sm font-bold">
                  <span className="text-cyan-300">Total Order Amount:</span>
                  <span className="text-white text-lg">₹{selectedProduct.wholesalePrice * quantity}</span>
                </div>

                <Button
                  type="submit"
                  disabled={orderLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                >
                  {orderLoading ? "Submitting Order..." : "Confirm & Order Wholesale Stock"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* Admin Add Product Dialog Modal */}
        {userRole === 'Admin' && (
          <Dialog open={isAdminAddOpen} onOpenChange={setIsAdminAddOpen}>
            <DialogContent className="bg-slate-900 text-slate-100 border-slate-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-cyan-500" />
                  Add Product to B2B Store (Admin Only)
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Add spare accessory with image URL to the wholesale store catalog.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAdminAddProduct} className="space-y-4 mt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Product Name</label>
                  <Input
                    placeholder="e.g. DishTV Remote Control"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                    required
                  />
                </div>

                {/* Product Image URL Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> Product Image Link / URL
                  </label>
                  <Input
                    placeholder="https://images.unsplash.com/photo-..."
                    value={prodImageUrl}
                    onChange={(e) => setProdImageUrl(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                  />
                  <p className="text-[10px] text-slate-400">
                    Paste product image web link (URL). If left blank, a default DishTV product image will be assigned.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Category</label>
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-xs text-slate-200"
                    >
                      <option value="Remotes">Remotes</option>
                      <option value="Cables">Cables</option>
                      <option value="Adapters">Adapters</option>
                      <option value="LNB">LNB</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Badge Label</label>
                    <Input
                      placeholder="e.g. HOT SELLER"
                      value={prodBadge}
                      onChange={(e) => setProdBadge(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Wholesale Price (₹)</label>
                    <Input
                      type="number"
                      value={prodWholesalePrice}
                      onChange={(e) => setProdWholesalePrice(Number(e.target.value))}
                      className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Retail MRP (₹)</label>
                    <Input
                      type="number"
                      value={prodMrp}
                      onChange={(e) => setProdMrp(Number(e.target.value))}
                      className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Min Qty</label>
                    <Input
                      type="number"
                      value={prodMinQty}
                      onChange={(e) => setProdMinQty(Number(e.target.value))}
                      className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <Input
                    placeholder="Describe compatibility & features..."
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-200 text-xs"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={addLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-10"
                >
                  {addLoading ? "Adding Product..." : "Publish Product with Image"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </main>
  );
}
