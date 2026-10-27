import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works under /NazoRiver-web/ (or any subfolder).
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
});
