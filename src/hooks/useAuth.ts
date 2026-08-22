
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedRole = typeof window !== "undefined" ? localStorage.getItem("userRole") : null;
    const storedShopName = typeof window !== "undefined" ? localStorage.getItem("shopName") : null;
    const storedStatus = typeof window !== "undefined" ? localStorage.getItem("userStatus") : null;
    if (storedRole) {
        setUserRole(storedRole);
    }
    if (storedShopName) {
        setShopName(storedShopName);
    }
    if (storedStatus) {
        setUserStatus(storedStatus);
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Always re-verify the role on auth state change for security.
        let finalRole: string | null = null;
        let fetchedShopName: string | null = null;
        let fetchedStatus: string = 'active';

        try {
          if (currentUser.email === 'psdgandepalli@gmail.com') {
            finalRole = 'Admin';
            fetchedShopName = 'Navanidhi Digital';
            fetchedStatus = 'active';
          } else {
            const staffQuery = query(collection(db, "staff"), where("uid", "==", currentUser.uid));
            const staffSnapshot = await getDocs(staffQuery);
            if (!staffSnapshot.empty) {
              const staffData = staffSnapshot.docs[0].data();
              finalRole = staffData.role || "Staff"; // Default to "Staff" if role is empty but doc exists
              fetchedShopName = staffData.name || "Staff Member";
              fetchedStatus = staffData.status || "active";
            } else {
              // Check for DishTV Dealer
              const dealerQueryByUid = query(collection(db, "dishtv_dealers"), where("uid", "==", currentUser.uid));
              let dealerSnapshot = await getDocs(dealerQueryByUid);

              if (dealerSnapshot.empty && currentUser.email) {
                const dealerQueryByEmail = query(collection(db, "dishtv_dealers"), where("formattedEmail", "==", currentUser.email));
                dealerSnapshot = await getDocs(dealerQueryByEmail);
              }

              if (!dealerSnapshot.empty) {
                finalRole = "Dealer";
                const dData = dealerSnapshot.docs[0].data();
                fetchedShopName = dData.dealerName || "Dealer";
                fetchedStatus = "active";
              } else {
                // Check for DishTV Retailer
                const retailerQueryByUid = query(collection(db, "dishtv_retailers"), where("uid", "==", currentUser.uid));
                let retailerSnapshot = await getDocs(retailerQueryByUid);

                if (retailerSnapshot.empty && currentUser.email) {
                  const retailerQueryByEmail = query(collection(db, "dishtv_retailers"), where("formattedEmail", "==", currentUser.email));
                  retailerSnapshot = await getDocs(retailerQueryByEmail);
                }

                if (!retailerSnapshot.empty) {
                  finalRole = "Retailer";
                  const rData = retailerSnapshot.docs[0].data();
                  fetchedShopName = rData.retailerName || rData.contactPerson || "Retailer";
                  fetchedStatus = "active";
                }
              }
            }
          }
          
          setUserRole(finalRole);
          setShopName(fetchedShopName);
          setUserStatus(fetchedStatus);
          
          if (typeof window !== "undefined") {
            if (finalRole) {
              localStorage.setItem("userRole", finalRole);
            } else {
              localStorage.removeItem("userRole");
            }
            if (fetchedShopName) {
              localStorage.setItem("shopName", fetchedShopName);
            } else {
              localStorage.removeItem("shopName");
            }
            if (fetchedStatus) {
              localStorage.setItem("userStatus", fetchedStatus);
            } else {
              localStorage.removeItem("userStatus");
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(null);
          setShopName(null);
          setUserStatus('active');
          if (typeof window !== "undefined") {
            localStorage.removeItem("userRole");
            localStorage.removeItem("shopName");
            localStorage.removeItem("userStatus");
          }
        }
      } else {
        // User is logged out
        setUser(null);
        setUserRole(null);
        setShopName(null);
        setUserStatus('active');
        if (typeof window !== "undefined") {
          localStorage.removeItem("userRole");
          localStorage.removeItem("shopName");
          localStorage.removeItem("userStatus");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userRole, shopName, userStatus, loading };
}
