import { useCallback, useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import {
  type UploadProgressPhotoInput,
  loadProgressPhotosSelf,
  uploadProgressPhotoSelf
} from "../../api/athleteProgressPhotosClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-28 athlete's own progress-photo upload/history -
// independently fetched, listens for kolosseum:history-changed (dispatched
// by app.js's refreshHistory(), which previously piggybacked
// refreshProgressPhotos() as a side effect - that call site is removed
// alongside this migration, same as every other athlete-self panel).
const CHANGED_EVENT = "kolosseum:history-changed";

export type AthleteProgressPhotosSelfState = {
  loading: boolean;
  error: string | null;
  photos: JsonRecord[];
  submitting: boolean;
  submitError: string | null;
};

const initialState: AthleteProgressPhotosSelfState = {
  loading: true,
  error: null,
  photos: [],
  submitting: false,
  submitError: null
};

export function useAthleteProgressPhotosSelf() {
  const [state, setState] = useState<AthleteProgressPhotosSelfState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const photos = await loadProgressPhotosSelf();
      setState((current) => ({ ...current, loading: false, photos }));
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Progress photos could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const upload = useCallback(async (input: UploadProgressPhotoInput): Promise<boolean> => {
    setState((current) => ({ ...current, submitting: true, submitError: null }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await uploadProgressPhotoSelf(input, csrfToken);
      setState((current) => ({ ...current, submitting: false }));
      await refresh();
      return true;
    }
    catch {
      setState((current) => ({ ...current, submitting: false, submitError: "Photo could not be uploaded." }));
      return false;
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    document.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      document.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { ...state, upload };
}
