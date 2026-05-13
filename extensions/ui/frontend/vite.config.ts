import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { domscribe } from "@domscribe/react/vite";

declare const process: { env: Record<string, string | undefined> };

const backendPort = process.env.LEM_UI_TEST_BACKEND_PORT ?? "8787";

export default defineConfig({
  plugins: [react(), domscribe()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true
      },
      "/ws": {
        target: `ws://127.0.0.1:${backendPort}`,
        ws: true
      }
    }
  }
});
