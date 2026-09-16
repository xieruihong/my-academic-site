import { renderToString } from "react-dom/server";
import Home from "./Home";
import Cv from "./Cv";

export function render() {
  return renderToString(<Home />);
}

export function renderCv() {
  return renderToString(<Cv />);
}
