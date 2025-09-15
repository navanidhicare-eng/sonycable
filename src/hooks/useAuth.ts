
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    if (storedRole) {
        setUserRole(storedRole);
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Only fetch role if it's not already set or if user changes
        const storedRole = typeof window !== 'undefined' ? localStorage.getItem("userRole") : null;
        let finalRole: string | null = storedRole;

        // Perform a fresh role check only if not present
        if (!finalRole) {
            try {
            if (currentUser.email === 'psdgandepalli@gmail.com') {
                finalRole = 'Admin';
            } else {
                const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
                const staffSnapshot = await getDocs(staffQuery);
                if (!staffSnapshot.empty) {
                const staffData = staffSnapshot.docs[0].data();
                finalRole = staffData.role || null;
                } else {
                const customerQuery = query(collection(db, "customers"), where("uid", "==", currentUser.uid));
                const customerSnapshot = await getDocs(customerQuery);
                if (!customerSnapshot.empty) {
                        finalRole = "Customer";
                }
                }
            }
            
            setUserRole(finalRole);
            
            if (typeof window !== "undefined") {
                if (finalRole) {
                    localStorage.setItem("userRole", finalRole);
                } else {
                    localStorage.removeItem("userRole");
                }
            }
            } catch (error) {
                console.error("Error fetching user role:", error);
                setUserRole(null);
                if (typeof window !== "undefined") {
                    localStorage.removeItem("userRole");
                }
            }
        }
      } else {
        setUser(null);
        setUserRole(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userRole, loading };
}
