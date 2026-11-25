import React from "react";

// Something didn't load: say so once, with a way to try again.
export function LoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="load-failed" role="status">
      <p>{message}</p>
      <button className="button secondary small-button" type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}
