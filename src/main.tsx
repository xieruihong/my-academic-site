import { createRoot, hydrateRoot } from "react-dom/client";
import Home from "./Home";
import Cv from "./Cv";
import "./globals.css";
import "./refinements.css";

const root = document.getElementById("root")!;
const Page = window.location.pathname.endsWith("/cv.html") ? Cv : Home;
if (Page === Cv) document.title = "Curriculum Vitae · Ruihong Xie";
if (root.querySelector("main")) {
  hydrateRoot(root, <Page />);
} else {
  createRoot(root).render(<Page />);
}
