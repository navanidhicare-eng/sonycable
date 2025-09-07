
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch role from localStorage first for faster UI update
        const cachedRole = localStorage.getItem("userRole");
        if (cachedRole) {
          setUserRole(cachedRole);
        }

        // Then, verify and fetch the latest role from Firestore
        let finalRole = null;
        if (currentUser.email === 'psdgandepalli@gmail.com') {
          finalRole = 'Admin';
        } else {
          const staffDocRef = doc(db, 'staff', currentUser.uid);
          const staffDocSnap = await getDoc(staffDocRef);
          if (staffDocSnap.exists()) {
            finalRole = staffDocSnap.data().role || null;
          }
        }
        
        setUserRole(finalRole);
        
        if (finalRole) {
          localStorage.setItem("userRole", finalRole);
        } else {
          // If no role is found in Firestore, clear it from local storage
          localStorage.removeItem("userRole");
        }

      } else {
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
