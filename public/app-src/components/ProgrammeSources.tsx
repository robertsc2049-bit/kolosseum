import React from "react";

// What a Kolosseum programme is based on - the original it follows, or the
// research behind its method (product/programmes/programme_sources.mjs) -
// folded under the programme's summary.
export function ProgrammeSources({ sources }: { sources: unknown }) {
  const list = (Array.isArray(sources) ? sources : [])
    .filter((source): source is { cite: unknown; url?: unknown } => !!source && typeof source === "object" && typeof (source as { cite?: unknown }).cite === "string");
  if (!list.length) return null;
  return (
    <details className="programme-sources" data-testid="programme-sources">
      <summary>{`Based on (${list.length})`}</summary>
      <ol>
        {list.map((source) => (
          <li key={String(source.cite)}>
            {String(source.cite)}
            {typeof source.url === "string" && source.url.startsWith("https://") ? <> <a href={source.url} target="_blank" rel="noreferrer">Link</a></> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
