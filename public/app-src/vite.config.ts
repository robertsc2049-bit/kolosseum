import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

// DEV NOTE: This build does not own public/app/index.html - that file is
// still the live shell for every non-migrated route. Output lands under
// public/app/react-dist/ (inside the directory express.static() already
// serves) with stable, non-hashed filenames, so index.html only ever needs
// one hand-added <script> tag rather than Vite regenerating markup.
export default defineConfig({
  root: here,
  plugins: [react()],
  build: {
    outDir: path.resolve(here, "../app/react-dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(here, "main.tsx"),
      output: {
        entryFileNames: "kolosseum-react.js",
        chunkFileNames: "kolosseum-react-[name].js",
        assetFileNames: "kolosseum-react-[name][extname]"
      }
    }
  }
});
