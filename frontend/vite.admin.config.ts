import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Frontend do LicencasAdmin (app separado, só no computador do fornecedor).
export default defineConfig({
  root: "admin",
  publicDir: "../public",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: { "/api": "http://127.0.0.1:8765" },
  },
  build: {
    outDir: "../dist-admin",
    emptyOutDir: true,
  },
});
