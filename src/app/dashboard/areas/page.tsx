"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2, Pencil, Trash2, MapPin, Building2, Home } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, deleteDoc, addDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
import { AP_LOCATIONS, CustomLocation, getMergedLocations } from "@/lib/apLocations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Area {
  id: string;
  name: string;
  description: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export default function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);

  const [isLocDeleteDialogOpen, setIsLocDeleteDialogOpen] = useState(false);
  const [locToDelete, setLocToDelete] = useState<CustomLocation | null>(null);

  // Form state for adding Location Hierarchy
  const [selectedDistrict, setSelectedDistrict] = useState("Anakapalli");
  const [newDistrictName, setNewDistrictName] = useState("");

  const [selectedMandal, setSelectedMandal] = useState("V.Madugula");
  const [newMandalName, setNewMandalName] = useState("");

  const [villageName, setVillageName] = useState("");
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  // Fetch Areas and Custom Locations from Firestore
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setLocationsLoading(false);
      return;
    }

    // Fetch Operational Areas
    const qAreas = query(collection(db, "areas"), where("userId", "==", user.uid));
    const unsubscribeAreas = onSnapshot(
      qAreas,
      (snapshot) => {
        const areasData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Area));
        areasData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAreas(areasData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching areas: ", error);
        setLoading(false);
      }
    );

    // Fetch Custom Locations
    const qLocs = query(collection(db, "custom_locations"), where("userId", "==", user.uid));
    const unsubscribeLocs = onSnapshot(
      qLocs,
      (snapshot) => {
        const locsData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as CustomLocation));
        setCustomLocations(locsData);
        setLocationsLoading(false);
      },
      (error) => {
        console.error("Error fetching custom locations: ", error);
        setLocationsLoading(false);
      }
    );

    return () => {
      unsubscribeAreas();
      unsubscribeLocs();
    };
  }, [user, authLoading]);

  // Combined Location Hierarchy (AP_LOCATIONS + CustomLocations)
  const mergedLocations = useMemo(() => {
    return getMergedLocations(customLocations);
  }, [customLocations]);

  // Available Mandals based on selectedDistrict
  const availableMandals = useMemo(() => {
    if (selectedDistrict === "__new__") return [];
    const distObj = mergedLocations.find((d) => d.district === selectedDistrict);
    return distObj ? distObj.mandals.map((m) => m.mandal) : [];
  }, [mergedLocations, selectedDistrict]);

  // Handle Add Custom Location
  const handleAddCustomLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const finalDistrict = selectedDistrict === "__new__" ? newDistrictName.trim() : selectedDistrict.trim();
    const finalMandal = selectedMandal === "__new__" ? newMandalName.trim() : selectedMandal.trim();
    const finalVillage = villageName.trim();

    if (!finalDistrict || !finalMandal || !finalVillage) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in District, Mandal, and Village names.",
      });
      return;
    }

    setIsAddingLocation(true);

    try {
      await addDoc(collection(db, "custom_locations"), {
        district: finalDistrict,
        mandal: finalMandal,
        village: finalVillage,
        userId: user.uid,
        createdAt: Timestamp.now(),
      });

      toast({
        title: "Location Added",
        description: `Successfully added ${finalVillage}, ${finalMandal}, ${finalDistrict}.`,
      });

      // Reset village name
      setVillageName("");
      if (selectedDistrict === "__new__") {
        setSelectedDistrict(finalDistrict);
        setNewDistrictName("");
      }
      if (selectedMandal === "__new__") {
        setSelectedMandal(finalMandal);
        setNewMandalName("");
      }
    } catch (error) {
      console.error("Error adding custom location:", error);
      toast({
        variant: "destructive",
        title: "Failed to Add",
        description: "Could not save custom location.",
      });
    } finally {
      setIsAddingLocation(false);
    }
  };

  // Delete Operational Area
  const handleDeleteArea = async () => {
    if (!areaToDelete) return;

    try {
      await deleteDoc(doc(db, "areas", areaToDelete.id));
      toast({
        title: "Area Deleted",
        description: `${areaToDelete.name} has been removed successfully.`,
      });
    } catch (error) {
      console.error("Error deleting area: ", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "An error occurred while deleting the area.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setAreaToDelete(null);
    }
  };

  // Delete Custom Location
  const handleDeleteLocation = async () => {
    if (!locToDelete || !locToDelete.id) return;

    try {
      await deleteDoc(doc(db, "custom_locations", locToDelete.id));
      toast({
        title: "Location Removed",
        description: `Removed ${locToDelete.village}, ${locToDelete.mandal}.`,
      });
    } catch (error) {
      console.error("Error deleting location: ", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "Could not delete custom location.",
      });
    } finally {
      setIsLocDeleteDialogOpen(false);
      setLocToDelete(null);
    }
  };

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground bg-muted/10 pb-12">
        <div className="container mx-auto p-4 py-8 md:p-8 space-y-8 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Location & Area Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage District, Mandal & Village location hierarchy and cable operational areas.
              </p>
            </div>
          </div>

          <Tabs defaultValue="hierarchy" className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-2xl h-auto p-1">
              <TabsTrigger value="hierarchy" className="py-2 text-xs md:text-sm">Location Hierarchy (District / Mandal / Village)</TabsTrigger>
              <TabsTrigger value="operational" className="py-2 text-xs md:text-sm">Operational Areas (Lines)</TabsTrigger>
            </TabsList>

            {/* TAB 1: LOCATION HIERARCHY */}
            <TabsContent value="hierarchy" className="space-y-6">
              {/* Form Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Add Custom Location
                  </CardTitle>
                  <CardDescription>
                    Add new districts, mandals, and villages. These will appear in DishTV and Cable customer dropdowns.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCustomLocation} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* District */}
                      <div className="space-y-2">
                        <Label htmlFor="distSelect">District</Label>
                        <Select
                          value={selectedDistrict}
                          onValueChange={(val) => {
                            setSelectedDistrict(val);
                            if (val !== "__new__") {
                              const distObj = mergedLocations.find((d) => d.district === val);
                              if (distObj && distObj.mandals.length > 0) {
                                setSelectedMandal(distObj.mandals[0].mandal);
                              } else {
                                setSelectedMandal("__new__");
                              }
                            } else {
                              setSelectedMandal("__new__");
                            }
                          }}
                        >
                          <SelectTrigger id="distSelect">
                            <SelectValue placeholder="Select District" />
                          </SelectTrigger>
                          <SelectContent>
                            {mergedLocations.map((d) => (
                              <SelectItem key={d.district} value={d.district}>
                                {d.district}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Add New District</SelectItem>
                          </SelectContent>
                        </Select>

                        {selectedDistrict === "__new__" && (
                          <Input
                            placeholder="Enter new District name..."
                            value={newDistrictName}
                            onChange={(e) => setNewDistrictName(e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>

                      {/* Mandal */}
                      <div className="space-y-2">
                        <Label htmlFor="mandalSelect">Mandal</Label>
                        <Select
                          value={selectedMandal}
                          onValueChange={(val) => setSelectedMandal(val)}
                          disabled={selectedDistrict === "__new__" && !newDistrictName.trim()}
                        >
                          <SelectTrigger id="mandalSelect">
                            <SelectValue placeholder="Select Mandal" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMandals.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Add New Mandal</SelectItem>
                          </SelectContent>
                        </Select>

                        {selectedMandal === "__new__" && (
                          <Input
                            placeholder="Enter new Mandal name..."
                            value={newMandalName}
                            onChange={(e) => setNewMandalName(e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>

                      {/* Village */}
                      <div className="space-y-2">
                        <Label htmlFor="villageInput">Village</Label>
                        <Input
                          id="villageInput"
                          placeholder="e.g. Kinthada, Rampuram..."
                          value={villageName}
                          onChange={(e) => setVillageName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={isAddingLocation}>
                        {isAddingLocation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Save Location
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Table Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Custom Added Locations List</CardTitle>
                  <CardDescription>
                    List of admin-added Districts, Mandals, and Villages stored for your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {locationsLoading ? (
                    <div className="flex justify-center items-center py-12 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                      <span>Loading locations...</span>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>District</TableHead>
                          <TableHead>Mandal</TableHead>
                          <TableHead>Village</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customLocations.length > 0 ? (
                          customLocations.map((loc) => (
                            <TableRow key={loc.id} className="hover:bg-muted/30">
                              <TableCell className="font-semibold text-foreground">{loc.district}</TableCell>
                              <TableCell>{loc.mandal}</TableCell>
                              <TableCell>{loc.village}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setLocToDelete(loc);
                                    setIsLocDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                              No custom locations added yet. Standard AP Districts/Mandals are active by default.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: OPERATIONAL AREAS (LINES) */}
            <TabsContent value="operational" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Operational Area List (Cable Lines)</CardTitle>
                    <CardDescription>Manage local operational lines (e.g. LINE-1, LINE-2).</CardDescription>
                  </div>
                  <Button asChild>
                    <Link href="/dashboard/areas/add">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Area
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading || authLoading ? (
                    <div className="flex justify-center items-center h-40 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                      <span>Loading operational areas...</span>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Area Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {areas.length > 0 ? (
                          areas.map((area) => (
                            <TableRow key={area.id}>
                              <TableCell className="font-semibold text-foreground">{area.name}</TableCell>
                              <TableCell>{area.description || "N/A"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" asChild>
                                    <Link href={`/dashboard/areas/${area.id}/edit`}>
                                      <Pencil className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setAreaToDelete(area);
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
                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                              No operational areas found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Delete Operational Area Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Operational Area?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{areaToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteArea} className="bg-destructive hover:bg-destructive/90">
              Delete Area
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Custom Location Alert */}
      <AlertDialog open={isLocDeleteDialogOpen} onOpenChange={setIsLocDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Location?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{locToDelete?.village}, {locToDelete?.mandal}</strong> from custom location list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLocation} className="bg-destructive hover:bg-destructive/90">
              Delete Location
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
