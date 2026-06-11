import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  test: {
    include: ["../tests/**/*.test.ts"]
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        onboarding: resolve(__dirname, "src/onboarding.html"),
        popup: resolve(__dirname, "src/popup.html"),
        sidebar: resolve(__dirname, "src/sidebar.html")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
