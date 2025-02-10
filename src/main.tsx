import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: "AIzaSyAuVEYjR9vcHXoxR0F3OVwecYgIPzxqhwQ",
  authDomain: "typr-84dbd.firebaseapp.com",
  projectId: "typr-84dbd",
  storageBucket: "typr-84dbd.firebasestorage.app",
  messagingSenderId: "663496765151",
  appId: "1:663496765151:web:e618e0aa874338108ec36a",
  measurementId: "G-88CHFMN7DX"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
