// Firebase 설정
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCaKhA7WvrYEMBLe7oGbVzF7NtVgs7Xrt4",
  authDomain: "snac25-69db3.firebaseapp.com",
  projectId: "snac25-69db3",
  storageBucket: "snac25-69db3.firebasestorage.app",
  messagingSenderId: "591580345710",
  appId: "1:591580345710:web:1ce7615e621c6aed4e3d7f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
export default app;

