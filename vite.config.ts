import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const SUPABASE_PROXY_TARGET = "https://gxxralruivyhdxyftsrg.supabase.co";
const SUPABASE_PROXY_PATH = "/supabase-proxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8000,
    strictPort: true,
    proxy: {
      [SUPABASE_PROXY_PATH]: {
        target: SUPABASE_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/supabase-proxy/, ""),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
