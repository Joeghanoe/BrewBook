import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API is reached through the same origin, like in production behind
// oauth2-proxy. The dev proxy fakes the proxy's identity headers so the API accepts the request.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_ORIGIN ?? "http://localhost:8080",
        changeOrigin: true,
        headers: {
          "X-Forwarded-Email": process.env.DEV_USER_EMAIL ?? "dev@brewbook.local",
          "X-Forwarded-User": "dev",
        },
      },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
