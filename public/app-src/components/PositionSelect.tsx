import React from "react";

// DEV NOTE: hand-synced with ATHLETE_POSITIONS_BY_ACTIVITY
// (src/api/athlete_onboarding_service.ts) - sports whose positions or event
// groups train differently get a real list (the athlete's position selects
// their group's programme); the others get a single generic "Athlete" option. A single <select>, unlike
// TrainingFocusCheckboxes.tsx's checkboxes - position is exactly one
// value, not zero-or-more.
export const POSITION_OPTIONS_BY_ACTIVITY: Record<string, readonly { id: string; label: string }[]> = {
  rugby_union: [
    { id: "loosehead_prop", label: "Loosehead prop" },
    { id: "tighthead_prop", label: "Tighthead prop" },
    { id: "hooker", label: "Hooker" },
    { id: "lock", label: "Lock" },
    { id: "flanker", label: "Flanker" },
    { id: "number8", label: "Number 8" },
    { id: "scrum_half", label: "Scrum-half" },
    { id: "fly_half", label: "Fly-half" },
    { id: "centre", label: "Centre" },
    { id: "wing", label: "Wing" },
    { id: "fullback", label: "Fullback" }
  ],
  powerlifting: [{ id: "athlete", label: "Athlete" }],
  general_strength: [{ id: "athlete", label: "Athlete" }],
  strongman: [{ id: "athlete", label: "Athlete" }],
  hyrox: [
    { id: "athlete", label: "Not specified" },
    { id: "women_open", label: "Women's Open (and women's Doubles)" },
    { id: "men_open", label: "Men's Open (and men's or mixed Doubles)" },
    { id: "women_pro", label: "Women's Pro" },
    { id: "men_pro", label: "Men's Pro" }
  ],
  crossfit: [{ id: "athlete", label: "Athlete" }],
  football_soccer: [
    { id: "athlete", label: "Not specified" },
    { id: "goalkeeper", label: "Goalkeeper" },
    { id: "defender", label: "Defender" },
    { id: "midfielder", label: "Midfielder" },
    { id: "forward", label: "Forward" }
  ],
  netball: [
    { id: "athlete", label: "Not specified" },
    { id: "goal_shooter", label: "Goal shooter" },
    { id: "goal_attack", label: "Goal attack" },
    { id: "wing_attack", label: "Wing attack" },
    { id: "centre", label: "Centre" },
    { id: "wing_defence", label: "Wing defence" },
    { id: "goal_defence", label: "Goal defence" },
    { id: "goal_keeper", label: "Goal keeper" }
  ],
  basketball: [
    { id: "athlete", label: "Not specified" },
    { id: "guard", label: "Guard" },
    { id: "forward", label: "Forward" },
    { id: "centre", label: "Centre" }
  ],
  rugby_sevens: [{ id: "athlete", label: "Athlete" }],
  field_hockey: [
    { id: "athlete", label: "Not specified" },
    { id: "goalkeeper", label: "Goalkeeper" },
    { id: "defender", label: "Defender" },
    { id: "midfielder", label: "Midfielder" },
    { id: "forward", label: "Forward" }
  ],
  ice_hockey: [
    { id: "athlete", label: "Not specified" },
    { id: "goaltender", label: "Goaltender" },
    { id: "defence", label: "Defence" },
    { id: "forward", label: "Forward" }
  ],
  volleyball: [
    { id: "athlete", label: "Not specified" },
    { id: "outside_hitter", label: "Outside hitter" },
    { id: "opposite", label: "Opposite" },
    { id: "middle_blocker", label: "Middle blocker" },
    { id: "setter", label: "Setter" },
    { id: "libero", label: "Libero" }
  ],
  cricket: [
    { id: "athlete", label: "Not specified" },
    { id: "fast_bowler", label: "Fast bowler" },
    { id: "spin_bowler", label: "Spin bowler" },
    { id: "batter", label: "Batter" },
    { id: "wicketkeeper", label: "Wicketkeeper" },
    { id: "all_rounder", label: "All-rounder" }
  ],
  american_football: [
    { id: "athlete", label: "Not specified" },
    { id: "offensive_lineman", label: "Offensive lineman" },
    { id: "defensive_lineman", label: "Defensive lineman" },
    { id: "tight_end", label: "Tight end" },
    { id: "linebacker", label: "Linebacker" },
    { id: "quarterback", label: "Quarterback" },
    { id: "running_back", label: "Running back" },
    { id: "wide_receiver", label: "Wide receiver" },
    { id: "defensive_back", label: "Defensive back" },
    { id: "kicker", label: "Kicker / punter" }
  ],
  athletics: [
    { id: "athlete", label: "Not specified" },
    { id: "sprints", label: "Sprints" },
    { id: "hurdles", label: "Hurdles" },
    { id: "jumps", label: "Jumps" },
    { id: "combined_events", label: "Combined events" },
    { id: "throws", label: "Throws" },
    { id: "middle_distance", label: "Middle distance" },
    { id: "long_distance", label: "Long distance" }
  ],
  swimming: [
    { id: "athlete", label: "Not specified" },
    { id: "sprint", label: "Sprint (50-100 m)" },
    { id: "distance", label: "Distance (400 m+)" }
  ],
  olympic_weightlifting: [{ id: "athlete", label: "Athlete" }],
  cycling: [
    { id: "athlete", label: "Not specified" },
    { id: "track_sprint", label: "Track sprint" },
    { id: "road", label: "Road / endurance" }
  ],
  rowing: [
    { id: "athlete", label: "Not specified" },
    { id: "sweep", label: "Sweep" },
    { id: "sculler", label: "Sculling" },
    { id: "lightweight", label: "Lightweight" }
  ],
  kayaking: [
    { id: "athlete", label: "Not specified" },
    { id: "sprint", label: "Sprint" },
    { id: "marathon", label: "Marathon" }
  ],
  boxing: [{ id: "athlete", label: "Athlete" }],
  wrestling: [{ id: "athlete", label: "Athlete" }],
  judo: [{ id: "athlete", label: "Athlete" }],
  brazilian_jiu_jitsu: [{ id: "athlete", label: "Athlete" }],
  muay_thai: [{ id: "athlete", label: "Athlete" }],
  mma: [{ id: "athlete", label: "Athlete" }],
  tennis: [{ id: "athlete", label: "Athlete" }],
  triathlon: [
    { id: "athlete", label: "Not specified" },
    { id: "short_course", label: "Sprint / Olympic distance" },
    { id: "long_course", label: "70.3 / Ironman" }
  ],
  rugby_league: [
    { id: "athlete", label: "Not specified" },
    { id: "prop", label: "Prop" },
    { id: "hooker", label: "Hooker" },
    { id: "second_row", label: "Second row" },
    { id: "loose_forward", label: "Loose forward" },
    { id: "halfback", label: "Halfback (scrum-half)" },
    { id: "stand_off", label: "Stand-off" },
    { id: "centre", label: "Centre" },
    { id: "wing", label: "Wing" },
    { id: "fullback", label: "Fullback" }
  ],
  street_lifting: [{ id: "athlete", label: "Athlete" }],
  grip_sport: [{ id: "athlete", label: "Athlete" }]
};

// Sports where a position (or event group) selects its own programme
// (the engine's role variants) - "Not specified" trains the sport's general week.
export const POSITION_PROGRAMME_SPORTS: ReadonlySet<string> = new Set([
  "rugby_union", "rugby_league", "american_football", "football_soccer", "field_hockey", "ice_hockey", "cricket", "athletics",
  "netball", "basketball", "volleyball", "swimming", "cycling", "rowing", "kayaking", "triathlon"
]);
export const POSITION_PROMPT = "Positions train differently in this sport - choose yours so your programme fits it.";

export function PositionSelect({ activityId, value, onChange, label = "Position" }: {
  activityId: string;
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const options = POSITION_OPTIONS_BY_ACTIVITY[activityId] ?? [];

  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
      {POSITION_PROGRAMME_SPORTS.has(activityId) && (!value || value === "athlete") ? <small className="field-hint">{POSITION_PROMPT}</small> : null}
    </label>
  );
}
