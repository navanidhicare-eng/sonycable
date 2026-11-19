import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAO-uwNtzknX2sDQREZbdSO-BTL9ZuoLDc",
  authDomain: "sony-cable-network.firebaseapp.com",
  projectId: "sony-cable-network",
  storageBucket: "sony-cable-network.firebasestorage.app",
  messagingSenderId: "519372037423",
  appId: "1:519372037423:web:aa5618a6f79350546ed5da"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const ref = doc(db, 'app_config', 'operator_app');
  const snap = await getDoc(ref);
  console.log('Current Firestore config:', snap.data());
  await setDoc(ref, {
    version: '1.0.12',
    latestVersion: '1.0.12',
    buildNumber: 2013,
    apkUrl: 'https://sony.navanidhi.org/downloads/SonyCable_Operator.apk',
    releaseNotes: '• Fixed new customer expiry date defaulting (new customers start as No Recharge until recharged)\n• Direct SIM SMS on Recharge & Collections\n• Custom Operator Lines & Packages\n• Clean Complaint Ticket IDs',
    mandatory: false,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  console.log('Updated app_config/operator_app to 1.0.12+2013 successfully!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
