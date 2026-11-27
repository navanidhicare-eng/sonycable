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
    version: '1.0.16',
    latestVersion: '1.0.16',
    buildNumber: 2018,
    apkUrl: 'https://sony.navanidhi.org/downloads/SonyCable_Operator.apk',
    releaseNotes: '• Optical Power Calculator (Ratio FBT & PLC Splitter)\n• Interactive loss reference cheat sheet\n• Fiber Map & Network Line Design improvements',
    mandatory: false,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  console.log('Updated app_config/operator_app to 1.0.16+2018 successfully!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
