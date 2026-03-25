import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBZv90g8jg9nRwA_JuJsNxJxrl0LnlcOrs",
  authDomain: "byte-e9d2f.firebaseapp.com",
  projectId: "byte-e9d2f",
  storageBucket: "byte-e9d2f.firebasestorage.app",
  messagingSenderId: "413917831219",
  appId: "1:413917831219:web:8bada756af6d13c6b44346",
};

const app = initializeApp(firebaseConfig);

// ✅ Export storage
export const storage = getStorage(app);