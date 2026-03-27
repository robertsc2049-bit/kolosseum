export const V1_RELEASE_CONTRACT = {
  version: "v1",

  scope: {
    phases: ["phase1","phase2","phase3","phase4","phase6"],
    features: [
      "compile",
      "session_execution",
      "split_return_gate",
      "replay",
      "aggregation",
      "data_products"
    ]
  },

  invariants: [
    "determinism",
    "replay_consistency",
    "append_only_events",
    "no_inference",
    "aggregate_only_products"
  ]
} as const;