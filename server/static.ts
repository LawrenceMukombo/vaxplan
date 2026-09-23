import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Ensure Service Worker is always served fresh and allowed across the entire origin
  app.get("/sw.js", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(path.resolve(distPath, "sw.js"));
  });

  // Alias PWA manifests so all browser scanners succeed
  app.get(["/manifest.json", "/manifest.webmanifest"], (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const manifestPath = path.resolve(distPath, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      res.sendFile(manifestPath);
    } else {
      res.status(404).end();
    }
  });

  // Alias favicon so standard icon queries never 404
  app.get("/favicon.ico", (_req, res) => {
    const icoPath = path.resolve(distPath, "favicon.ico");
    if (fs.existsSync(icoPath)) {
      res.sendFile(icoPath);
    } else {
      res.sendFile(path.resolve(distPath, "favicon.png"));
    }
  });

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
