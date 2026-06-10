
// DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic
// engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or
// outputs unless routed through an explicit validated contract.

export type OrgDataProduct = {
  org_id: string;
  generated_at: string;

  totals: {
    sessions_completed: number;
    sessions_split: number;
    sessions_abandoned: number;
  };

  exercises: {
    completed_ids: string[];
    dropped_ids: string[];
    remaining_ids: string[];
  };

  splits: {
    entered: number;
    return_continue: number;
    return_skip: number;
  };
};
