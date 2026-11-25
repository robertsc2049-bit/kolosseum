import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, transformWithEsbuild, type Plugin } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "../app");
const out = path.join(app, "shell-dist");

// The styles, compacted, beside the code.
function compactStyles(): Plugin {
  return {
    name: "kolosseum-compact-styles",
    async closeBundle() {
      for (const name of ["theme.css", "styles.css"]) {
        const { code } = await transformWithEsbuild(fs.readFileSync(path.join(app, name), "utf8"), name, { loader: "css", minify: true, target: "safari16" });
        fs.writeFileSync(path.join(out, name), code);
      }
    }
  };
}

// public/app's own modules (app.js, routes, tours and what they import) as two
// files: base.js for everyone (shell.js starts it), and coach.js, fetched only for a coach. The
// server puts these in the page when they're there (src/api/product_assets.ts);
// without a build the page uses the source files as they are.
export default defineConfig({
  root: here,
  base: "./",
  publicDir: false,
  plugins: [compactStyles()],
  build: {
    outDir: out,
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: path.join(app, "shell.js"),
      preserveEntrySignatures: "allow-extension",
      output: {
        entryFileNames: "shell.js",
        chunkFileNames: "[name].js",
        manualChunks: (id) => {
          const file = path.relative(app, id).split(path.sep).join("/");
          if (file.startsWith("..") || file === "shell.js") return undefined;
          return file.startsWith("coach/") ? "coach" : "base";
        }
      }
    }
  }
});
