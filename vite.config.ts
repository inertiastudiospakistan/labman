import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    server: {
      
      host: "0.0.0.0",
                         // 👈 ensures Vite NEVER changes port

      // 👇 HMR config that fixes ngrok blocking
      hmr: {
        protocol: "ws",
        host: "localhost",
        clientPort: 3000,
        allowedHosts: [
          "ngrok-free.app",
          "ngrok-free.dev",
          "shippable-ryan-uninhibitedly.ngrok-free.dev"
        ]
      }
    },

    plugins: [react()],
    base: "/labman/",

    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY)
    },

    resolve: {
      alias: {
        "@": path.resolve(__dirname, ".")
      }
    }
  };
});
