import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "./services/firebase"; // This will initialize Firebase
import { Toaster } from "react-hot-toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: "#323437",
          color: "#d1d0c5",
        },
        success: {
          iconTheme: {
            primary: "#e2b714",
            secondary: "#323437",
          },
        },
      }}
    />
    <App />
  </StrictMode>
);
