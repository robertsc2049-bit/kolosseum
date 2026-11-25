// The app outside its React panels: signing in, moving between screens, and
// what those screens share. Everyone gets core/; a coach also gets coach/
// (programmes, the builder, athletes), loaded once they're known to be one.
import { bootstrapApplication } from "./core/account.js";
import { handleError } from "./core/notices.js";
import "./core/sections.js";

bootstrapApplication()
  .catch(handleError);
