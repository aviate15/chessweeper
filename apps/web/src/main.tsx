import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

const SpritesPage = lazy(() => import("./pages/SpritesPage"));

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
const showSprites = location.pathname.replace(/\/+$/, "").endsWith("/sprites");
createRoot(root).render(
  <StrictMode>
    {showSprites ? (
      <Suspense fallback={null}>
        <SpritesPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
