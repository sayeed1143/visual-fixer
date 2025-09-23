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
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : (reason && reason.message);
  if (msg && (
      msg.includes('listener indicated an asynchronous response') ||
      msg.includes('message channel closed')
    )) {
    // Suppress browser extension promise rejections
    event.preventDefault();
    console.warn('Browser extension promise rejection suppressed:', msg);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
