/**
 * Standalone Vite config that builds the app as a pure static SPA
 * (no SSR, no server functions runtime) for wrapping with Capacitor
 * to produce Android / iOS binaries.
 *
 * Output: `dist-spa/index.html` + hashed assets, ready to be copied
 * into a Capacitor `webDir`.
 *
 * Run with: `bun run build:spa` (or `npm run build:spa`).
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: path.resolve(__dirname, "src/routes"),
      generatedRouteTree: path.resolve(__dirname, "src/routeTree.gen.ts"),
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
    {
      // Capacitor loads from file:// — rename the emitted html to index.html.
      name: "spa-rename-index",
      closeBundle() {
        const outDir = path.resolve(__dirname, "dist-spa");
        const from = path.join(outDir, "index.spa.html");
        const to = path.join(outDir, "index.html");
        if (fs.existsSync(from)) {
          fs.renameSync(from, to);
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Use relative asset paths so the bundle works under file:// in Capacitor.
  base: "./",
  build: {
    outDir: "dist-spa",
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      input: path.resolve(__dirname, "index.spa.html"),
    },
  },
});