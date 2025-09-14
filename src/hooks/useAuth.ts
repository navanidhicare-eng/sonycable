
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        let finalRole: string | null = null;
        try {
          if (currentUser.email === 'psdgandepalli@gmail.com') {
            finalRole = 'Admin';
          } else {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty) {
              const staffData = staffSnapshot.docs[0].data();
              finalRole = staffData.role || null;
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
            // Keep user authenticated but with no role
            setUserRole(null);
            if (typeof window !== "undefined") {
                localStorage.removeItem("userRole");
            }
        } finally {
            setLoading(false);
        }
      } else {
        setUser(null);
        setUserRole(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, userRole, loading };
}
