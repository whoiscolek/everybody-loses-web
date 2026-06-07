import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAN692k0cnY3NaYoWG3oxZtToNanhCyrU8",
  authDomain: "everyone-loses.firebaseapp.com",
  projectId: "everyone-loses",
  storageBucket: "everyone-loses.firebasestorage.app",
  messagingSenderId: "105599824063",
  appId: "1:105599824063:web:a566b31d751848484ed60a"
};

export const hasFirebaseConfig = true;
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
