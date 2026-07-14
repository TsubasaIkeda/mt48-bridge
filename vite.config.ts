import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Node 向けの SSR ビルド。依存は自動で external 化され、bundle されない。
    ssr: "src/main.ts",
    target: "node20",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        format: "esm",
        entryFileNames: "bridge.js",
      },
    },
  },
});
