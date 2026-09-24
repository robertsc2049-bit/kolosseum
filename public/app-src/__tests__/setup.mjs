// DEV NOTE: jsdom globals must exist before @testing-library/react is first
// imported by any test file - loaded via a separate `--import` flag ahead of
// the tsx/esm loader so this runs first regardless of test file order.
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/"
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.customElements = dom.window.customElements;

// Node 21+ defines a read-only global `navigator` getter - override it with
// jsdom's so testing-library sees a consistent DOM environment.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
  writable: true
});

for (const key of ["CustomEvent", "Event", "MouseEvent", "KeyboardEvent"]) {
  globalThis[key] = dom.window[key];
}
