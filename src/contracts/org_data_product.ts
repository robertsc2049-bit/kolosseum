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