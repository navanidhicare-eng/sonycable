"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Loader2, Pencil, Trash2, Notebook, GripVertical } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, where, writeBatch, Timestamp, getDocs } from "firebase/firestore";
import { format } from "date-fns";

// Schemas
const categorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
});
const noteSchema = z.object({
  title: z.string().min(1, "Title is required."),
  content: z.string().min(1, "Content is required."),
});
type CategoryFormValues = z.infer<typeof categorySchema>;
type NoteFormValues = z.infer<typeof noteSchema>;

// Interfaces
interface Category {
  id: string;
  name: string;
}
interface Note {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  createdAt: Timestamp;
}
interface Staff {
  adminId: string;
}

export default function MyNotesPage() {
  const { toast } = useToast();
  const { user, userRole, loading: authLoading } = useAuth();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataScopeId, setDataScopeId] = useState<string | null>(null); // This will be adminId or user.uid

  // State for dialogs
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // State for tracking what's being edited/deleted
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'note' | 'category', id: string } | null>(null);

  // Forms
  const categoryForm = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema) });
  const noteForm = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema) });

  useEffect(() => {
    if (!user) {
        if(!authLoading) setLoading(false);
        return;
    };

    const determineScope = async () => {
        setLoading(true);
        let scopeId: string | null = null;
        if (userRole === 'Admin') {
            scopeId = user.uid;
        } else if (userRole) {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", user.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty) {
                const staffData = staffSnapshot.docs[0].data() as Staff;
                scopeId = staffData.adminId;
            }
        }
        setDataScopeId(scopeId);
    };
    
    determineScope();

  }, [user, userRole, authLoading]);

  useEffect(() => {
    if (!dataScopeId) return;
    
    const catQuery = query(collection(db, "noteCategories"), where("userId", "==", dataScopeId));
    const notesQuery = query(collection(db, "notes"), where("userId", "==", dataScopeId));

    const unsubCategories = onSnapshot(catQuery, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    }, () => setLoading(false));

    const unsubNotes = onSnapshot(notesQuery, (snapshot) => {
      const noteData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(noteData);
      setLoading(false);
    }, () => setLoading(false));

    return () => {
      unsubCategories();
      unsubNotes();
    };
  }, [dataScopeId]);

  // Handlers for Category
  const handleCategorySubmit = async (data: CategoryFormValues) => {
    if (!dataScopeId) return;
    try {
      if (editingCategory) {
        await updateDoc(doc(db, "noteCategories", editingCategory.id), { name: data.name });
        toast({ title: "Category Updated" });
      } else {
        await addDoc(collection(db, "noteCategories"), { ...data, userId: dataScopeId });
        toast({ title: "Category Created" });
      }
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save category." });
    }
  };
  
  // Handlers for Note
  const handleNoteSubmit = async (data: NoteFormValues) => {
    if (!dataScopeId || !activeCategoryId) return;
    try {
      if (editingNote) {
        await updateDoc(doc(db, "notes", editingNote.id), data);
        toast({ title: "Note Updated" });
      } else {
        await addDoc(collection(db, "notes"), { ...data, categoryId: activeCategoryId, userId: dataScopeId, createdAt: new Date() });
        toast({ title: "Note Created" });
      }
      setIsNoteDialogOpen(false);
      setEditingNote(null);
      noteForm.reset();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not save note." });
    }
  };
  
  const openDeleteDialog = (type: 'note' | 'category', id: string) => {
    setItemToDelete({ type, id });
    setIsDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'category') {
        // Delete category and all its notes
        const batch = writeBatch(db);
        const categoryDocRef = doc(db, "noteCategories", itemToDelete.id);
        batch.delete(categoryDocRef);
        notes.filter(n => n.categoryId === itemToDelete.id).forEach(note => {
            const noteDocRef = doc(db, "notes", note.id);
            batch.delete(noteDocRef);
        });
        await batch.commit();
        toast({ title: "Category Deleted", description: "The category and all its notes have been deleted." });
      } else { // It's a note
        await deleteDoc(doc(db, "notes", itemToDelete.id));
        toast({ title: "Note Deleted" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const openCategoryDialog = (category: Category | null = null) => {
    setEditingCategory(category);
    categoryForm.reset(category ? { name: category.name } : { name: '' });
    setIsCategoryDialogOpen(true);
  }

  const openNoteDialog = (category: Category, note: Note | null = null) => {
    setActiveCategoryId(category.id);
    setEditingNote(note);
    noteForm.reset(note ? { title: note.title, content: note.content } : { title: '', content: '' });
    setIsNoteDialogOpen(true);
  }

  return (
    <>
      <main className="min-h-screen w-full font-body text-foreground">
        <div className="container mx-auto flex flex-col items-center p-4 py-8 md:p-12">
          <header className="mb-10 flex w-full max-w-4xl flex-col items-center text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h1 className="text-4xl font-bold tracking-tighter md:text-5xl">My Notes</h1>
              <p className="mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl">Organize your thoughts and information by category.</p>
            </div>
            <Button onClick={() => openCategoryDialog()} className="mt-4 sm:mt-0">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Category
            </Button>
          </header>

          <div className="w-full max-w-4xl">
            {loading || authLoading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : categories.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                    {categories.map((category) => (
                        <Card key={category.id} className="mb-4">
                            <AccordionItem value={category.id} className="border-b-0">
                                <div className="flex justify-between w-full items-center p-4">
                                    <AccordionTrigger className="p-0 flex-1 hover:no-underline">
                                        <div className="flex items-center gap-3">
                                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                                            <span className="font-semibold text-lg">{category.name}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <div className="flex items-center gap-2 pl-4">
                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNoteDialog(category); }}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Note
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openCategoryDialog(category); }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openDeleteDialog('category', category.id); }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                <AccordionContent>
                                    <div className="p-4 pt-0">
                                        {notes.filter(n => n.categoryId === category.id).length > 0 ? (
                                            <div className="space-y-3">
                                                {notes.filter(n => n.categoryId === category.id)
                                                    .sort((a,b) => b.createdAt.seconds - a.createdAt.seconds)
                                                    .map(note => (
                                                        <div key={note.id} className="border rounded-lg p-3 relative group">
                                                             <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button size="icon" variant="ghost" onClick={() => openNoteDialog(category, note)}><Pencil className="h-4 w-4" /></Button>
                                                                <Button size="icon" variant="ghost" onClick={() => openDeleteDialog('note', note.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                            </div>
                                                            <h4 className="font-bold">{note.title}</h4>
                                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                                                            <p className="text-xs text-muted-foreground/70 mt-2">{format(note.createdAt.toDate(), "PPP p")}</p>
                                                        </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-4">No notes in this category yet.</p>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Card>
                    ))}
                </Accordion>
            ) : (
              <div className="text-center py-16 border border-dashed rounded-lg">
                <Notebook className="mx-auto h-12 w-12 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">No Categories Found</h2>
                <p className="text-muted-foreground mt-2">Get started by creating your first category.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit" : "Add"} Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
            <Input {...categoryForm.register("name")} placeholder="Category Name" />
            {categoryForm.formState.errors.name && <p className="text-sm text-destructive">{categoryForm.formState.errors.name.message}</p>}
            <DialogFooter>
                <Button type="submit" disabled={categoryForm.formState.isSubmitting}>
                  {categoryForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit" : "Add"} Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={noteForm.handleSubmit(handleNoteSubmit)} className="space-y-4">
            <Input {...noteForm.register("title")} placeholder="Note Title" />
             {noteForm.formState.errors.title && <p className="text-sm text-destructive">{noteForm.formState.errors.title.message}</p>}
            <Textarea {...noteForm.register("content")} placeholder="Your note..." rows={8} />
             {noteForm.formState.errors.content && <p className="text-sm text-destructive">{noteForm.formState.errors.content.message}</p>}
            <DialogFooter>
                <Button type="submit" disabled={noteForm.formState.isSubmitting}>
                   {noteForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Save Note
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {itemToDelete?.type}.
              {itemToDelete?.type === 'category' && " All notes within this category will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
