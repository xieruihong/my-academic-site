import { createRoot, hydrateRoot } from "react-dom/client";
import Home from "./Home";
import "./globals.css";

const root = document.getElementById("root")!;
if (root.querySelector("main")) {
  hydrateRoot(root, <Home />);
} else {
  createRoot(root).render(<Home />);
}
