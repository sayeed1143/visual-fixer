import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Handle browser extension errors
window.addEventListener('error', (event) => {
  if (event.message.includes('listener indicated an asynchronous response') || 
      event.message.includes('message channel closed')) {
    // Suppress browser extension errors
    event.preventDefault();
    console.warn('Browser extension error suppressed:', event.message);
    return false;
  }
});

// Handle unhandled promise rejections from browser extensions
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      (event.reason.message.includes('listener indicated an asynchronous response') ||
       event.reason.message.includes('message channel closed'))) {
    // Suppress browser extension promise rejections
    event.preventDefault();
    console.warn('Browser extension promise rejection suppressed:', event.reason.message);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
