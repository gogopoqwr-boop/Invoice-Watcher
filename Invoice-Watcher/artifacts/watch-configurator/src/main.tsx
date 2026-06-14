import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Live-update CSS vars --mouse-x / --mouse-y so every .liquid-glass and
// .liquid-button surface reacts to the cursor position in real time.
document.addEventListener("mousemove", (e) => {
  document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
  document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
});

createRoot(document.getElementById("root")!).render(<App />);
