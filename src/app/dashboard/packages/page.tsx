"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PlusCircle, Loader2, Edit, Trash2, Tv, Radio } from "lucide-react";

export interface PackageItem {
  id: string;
  packageName: string;
  packageAmount: string; // 1 Month
  threeMonthAmount?: string;
  sixMonthAmount?: string;
  twelveMonthAmount?: string;
  description?: string;
  type?: "dishtv" | "cable";
  isBuiltIn?: boolean;
  userId?: string;
  createdAt?: any;
}

const BUILT_IN_DISHTV_PACKAGES: PackageItem[] = [
  {
    id: "builtin-sambaralu-telugu",
    packageName: "sambaralu telugu",
    packageAmount: "350",
    threeMonthAmount: "1050",
    sixMonthAmount: "2100",
    twelveMonthAmount: "4200",
    description: "Standard Telugu Entertainment Pack",
    type: "dishtv",
    isBuiltIn: true,
  },
  {
    id: "builtin-sambaralu-telugu-hd",
    packageName: "sambaralu telugu HD",
    packageAmount: "450",
    threeMonthAmount: "1350",
    sixMonthAmount: "2700",
    twelveMonthAmount: "5400",
    description: "High Definition Telugu Pack",
    type: "dishtv",
    isBuiltIn: true,
  },
];

export default function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pkgToDelete, setPkgToDelete] = useState<PackageItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    packageName: "",
    packageAmount: "",
    threeMonthAmount: "",
    sixMonthAmount: "",
    twelveMonthAmount: "",
    description: "",
    type: "dishtv" as "dishtv" | "cable",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, "packages"), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const dbPkgs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as PackageItem[];

        setPackages(dbPkgs);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching packages:", error);
        toast({
          variant: "destructive",
          title: "Failed to fetch packages",
          description: "Could not retrieve package data.",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading, toast]);

  // Separate packages into DishTV vs Cable TV
  const dishTvPackagesList = useMemo(() => {
    const dbDishTv = packages.filter(
      (pkg) => pkg.type === "dishtv" || (!pkg.type && !/sdv/i.test(pkg.packageName))
    );

    // Merge built-in packages if not overridden in db
    const merged = [...BUILT_IN_DISHTV_PACKAGES];
    dbDishTv.forEach((dbPkg) => {
      const idx = merged.findIndex(
        (m) => m.packageName.toLowerCase() === dbPkg.packageName.toLowerCase()
      );
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...dbPkg, isBuiltIn: false };
      } else {
        merged.push(dbPkg);
      }
    });

    return merged;
  }, [packages]);

  const cablePackagesList = useMemo(() => {
    return packages.filter(
      (pkg) => pkg.type === "cable" || /sdv/i.test(pkg.packageName)
    );
  }, [packages]);

  // Auto-fill 3m, 6m, 12m when 1m is entered in Package form
  const handle1MonthChange = (val: string) => {
    const num = parseFloat(val) || 0;
    setFormData((prev) => ({
      ...prev,
      packageAmount: val,
      threeMonthAmount: num ? String(num * 3) : "",
      sixMonthAmount: num ? String(num * 6) : "",
      twelveMonthAmount: num ? String(num * 12) : "",
    }));
  };

  const handleOpenAdd = (defaultType: "dishtv" | "cable" = "dishtv") => {
    setEditingPkg(null);
    setFormData({
      packageName: "",
      packageAmount: "",
      threeMonthAmount: "",
      sixMonthAmount: "",
      twelveMonthAmount: "",
      description: "",
      type: defaultType,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (pkg: PackageItem) => {
    setEditingPkg(pkg);
    const mAmt = pkg.packageAmount || "";
    const num = parseFloat(mAmt) || 0;
    setFormData({
      packageName: pkg.packageName || "",
      packageAmount: mAmt,
      threeMonthAmount: pkg.threeMonthAmount || (num ? String(num * 3) : ""),
      sixMonthAmount: pkg.sixMonthAmount || (num ? String(num * 6) : ""),
      twelveMonthAmount: pkg.twelveMonthAmount || (num ? String(num * 12) : ""),
      description: pkg.description || "",
      type: pkg.type || (/sdv/i.test(pkg.packageName) ? "cable" : "dishtv"),
    });
    setIsDialogOpen(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.packageName.trim() || !formData.packageAmount.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please provide Package Name and 1 Month Amount.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingPkg && !editingPkg.isBuiltIn) {
        // Update existing package in DB
        await updateDoc(doc(db, "packages", editingPkg.id), {
          packageName: formData.packageName.trim(),
          packageAmount: formData.packageAmount.trim(),
          threeMonthAmount: formData.threeMonthAmount.trim(),
          sixMonthAmount: formData.sixMonthAmount.trim(),
          twelveMonthAmount: formData.twelveMonthAmount.trim(),
          description: formData.description.trim(),
          type: formData.type,
        });

        toast({
          title: "Package Updated",
          description: `${formData.packageName} details updated successfully.`,
        });
      } else {
        // Add new package to DB
        await addDoc(collection(db, "packages"), {
          packageName: formData.packageName.trim(),
          packageAmount: formData.packageAmount.trim(),
          threeMonthAmount: formData.threeMonthAmount.trim(),
          sixMonthAmount: formData.sixMonthAmount.trim(),
          twelveMonthAmount: formData.twelveMonthAmount.trim(),
          description: formData.description.trim(),
          type: formData.type,
          userId: user.uid,
          createdAt: Timestamp.now(),
        });

        toast({
          title: "Package Created",
          description: `${formData.packageName} added successfully.`,
        });
      }

      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error saving package:", err);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save package details.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePackage = async () => {
    if (!pkgToDelete || !user) return;
    if (pkgToDelete.isBuiltIn) {
      toast({
        variant: "destructive",
        title: "System Package",
        description: "Default built-in packages cannot be deleted.",
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      await deleteDoc(doc(db, "packages", pkgToDelete.id));
      toast({
        title: "Package Deleted",
        description: `${pkgToDelete.packageName} removed successfully.`,
      });
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "An error occurred while deleting the package.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setPkgToDelete(null);
    }
  };

  return (
    <main className="min-h-screen w-full font-body text-foreground bg-muted/10">
      <div className="container mx-auto p-4 py-8 md:p-8 space-y-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Package Management</h1>
            <p className="text-muted-foreground mt-1">
              Configure default prices for DishTV channel packs and Cable TV packages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => handleOpenAdd("dishtv")} className="bg-orange-600 hover:bg-orange-700 text-white">
              <Tv className="mr-2 h-4 w-4" />
              Add DishTV Package
            </Button>
            <Button onClick={() => handleOpenAdd("cable")} variant="outline">
              <Radio className="mr-2 h-4 w-4" />
              Add Cable Package
            </Button>
          </div>
        </div>

        {/* Tabs for DishTV vs Cable TV Packages */}
        <Tabs defaultValue="dishtv" className="w-full space-y-6">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2 p-1 bg-muted rounded-xl">
            <TabsTrigger value="dishtv" className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              DishTV Packages
            </TabsTrigger>
            <TabsTrigger value="cable" className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Cable TV (SDV)
            </TabsTrigger>
          </TabsList>

          {/* DISHTV PACKAGES TAB */}
          <TabsContent value="dishtv" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Tv className="h-5 w-5 text-orange-500" />
                    DishTV Channel Packs & Default Prices
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Set default 1 Month, 3 Months, 6 Months, and 12 Months rates for DishTV customers.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => handleOpenAdd("dishtv")} className="bg-orange-600 hover:bg-orange-700 text-white">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Pack
                </Button>
              </CardHeader>
              <CardContent>
                {loading || authLoading ? (
                  <div className="flex justify-center items-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                    <span>Loading DishTV packages...</span>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[220px]">Package Name</TableHead>
                          <TableHead>1 Month (₹)</TableHead>
                          <TableHead>3 Months (₹)</TableHead>
                          <TableHead>6 Months (₹)</TableHead>
                          <TableHead>12 Months (₹)</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dishTvPackagesList.length > 0 ? (
                          dishTvPackagesList.map((pkg) => {
                            const mAmt = parseFloat(pkg.packageAmount) || 0;
                            const t3 = pkg.threeMonthAmount || (mAmt ? String(mAmt * 3) : "—");
                            const t6 = pkg.sixMonthAmount || (mAmt ? String(mAmt * 6) : "—");
                            const t12 = pkg.twelveMonthAmount || (mAmt ? String(mAmt * 12) : "—");

                            return (
                              <TableRow key={pkg.id}>
                                <TableCell className="font-semibold text-foreground flex items-center gap-2">
                                  {pkg.packageName}
                                  {pkg.isBuiltIn && (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase">
                                      Default
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="font-mono text-sm font-semibold bg-orange-50 text-orange-700 border-orange-200">
                                    ₹{pkg.packageAmount}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-sm">₹{t3}</TableCell>
                                <TableCell className="font-medium text-sm">₹{t6}</TableCell>
                                <TableCell className="font-medium text-sm">₹{t12}</TableCell>
                                <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                                  {pkg.description || "Default DishTV Package"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Edit Package Rates"
                                      onClick={() => handleOpenEdit(pkg)}
                                    >
                                      <Edit className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    </Button>
                                    {!pkg.isBuiltIn && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Delete Package"
                                        onClick={() => {
                                          setPkgToDelete(pkg);
                                          setIsDeleteDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              No DishTV packages found. Click "Add DishTV Package" to create one.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CABLE TV / SDV PACKAGES TAB */}
          <TabsContent value="cable" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Radio className="h-5 w-5 text-blue-500" />
                    Cable TV (SDV) Packages
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Manage standard Cable TV & SDV packs.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => handleOpenAdd("cable")} variant="outline">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Cable Pack
                </Button>
              </CardHeader>
              <CardContent>
                {loading || authLoading ? (
                  <div className="flex justify-center items-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                    <span>Loading Cable packages...</span>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Package Name</TableHead>
                          <TableHead>Monthly Amount (₹)</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cablePackagesList.length > 0 ? (
                          cablePackagesList.map((pkg) => (
                            <TableRow key={pkg.id}>
                              <TableCell className="font-medium">{pkg.packageName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">₹{pkg.packageAmount}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">{pkg.description || "N/A"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEdit(pkg)}
                                  >
                                    <Edit className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setPkgToDelete(pkg);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No Cable TV packages found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add / Edit Package Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {formData.type === "dishtv" ? (
                <Tv className="h-5 w-5 text-orange-600" />
              ) : (
                <Radio className="h-5 w-5 text-blue-600" />
              )}
              {editingPkg ? "Edit Package Details" : `Add New ${formData.type === "dishtv" ? "DishTV" : "Cable"} Package`}
            </DialogTitle>
            <DialogDescription>
              Set package name and default prices for multi-month subscriptions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePackage} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="packageName">Package Name *</Label>
              <Input
                id="packageName"
                required
                placeholder="e.g. sambaralu telugu HD"
                value={formData.packageName}
                onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
              />
            </div>

            {formData.type === "dishtv" ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Default Recharge Prices (₹)
                </Label>
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
                  <div>
                    <Label htmlFor="pkg1m" className="text-xs text-muted-foreground">1 Month (₹) *</Label>
                    <Input
                      id="pkg1m"
                      type="number"
                      required
                      placeholder="350"
                      value={formData.packageAmount}
                      onChange={(e) => handle1MonthChange(e.target.value)}
                      className="mt-1 bg-background text-sm h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pkg3m" className="text-xs text-muted-foreground">3 Months (₹)</Label>
                    <Input
                      id="pkg3m"
                      type="number"
                      placeholder="1050"
                      value={formData.threeMonthAmount}
                      onChange={(e) => setFormData({ ...formData, threeMonthAmount: e.target.value })}
                      className="mt-1 bg-background text-sm h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pkg6m" className="text-xs text-muted-foreground">6 Months (₹)</Label>
                    <Input
                      id="pkg6m"
                      type="number"
                      placeholder="2100"
                      value={formData.sixMonthAmount}
                      onChange={(e) => setFormData({ ...formData, sixMonthAmount: e.target.value })}
                      className="mt-1 bg-background text-sm h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pkg12m" className="text-xs text-muted-foreground">12 Months (₹)</Label>
                    <Input
                      id="pkg12m"
                      type="number"
                      placeholder="4200"
                      value={formData.twelveMonthAmount}
                      onChange={(e) => setFormData({ ...formData, twelveMonthAmount: e.target.value })}
                      className="mt-1 bg-background text-sm h-9"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="cableAmount">Monthly Package Amount (₹) *</Label>
                <Input
                  id="cableAmount"
                  type="number"
                  required
                  placeholder="e.g. 300"
                  value={formData.packageAmount}
                  onChange={(e) => setFormData({ ...formData, packageAmount: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pkgDesc">Description / Channel Notes</Label>
              <Textarea
                id="pkgDesc"
                placeholder="Optional package description or details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="resize-none h-20 text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingPkg ? "Update Package" : "Save Package"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{pkgToDelete?.packageName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePackage}
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
