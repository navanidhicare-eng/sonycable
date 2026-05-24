
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
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Always re-verify the role on auth state change for security.
        let finalRole: string | null = null;
        try {
          if (currentUser.email === 'psdgandepalli@gmail.com') {
            finalRole = 'Admin';
          } else {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty) {
              const staffData = staffSnapshot.docs[0].data();
              finalRole = staffData.role || "Staff"; // Default to "Staff" if role is empty but doc exists
            }
          }
          
          setUserRole(finalRole);
          
          if (typeof window !== "undefined") {
            if (finalRole) {
              localStorage.setItem("userRole", finalRole);
            } else {
              // If no role is found, clear it to prevent stale roles.
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
      } else {
        // User is logged out
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
