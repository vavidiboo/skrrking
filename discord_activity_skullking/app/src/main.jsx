import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { App } from "./App.jsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root container for Skull King React app");
}

const root = createRoot(rootElement);

flushSync(() => {
  root.render(<App />);
});

import("../legacy-app.js").catch((error) => {
  console.error("[SkullKing][BootstrapImportFailed]", error);
  throw error;
});
