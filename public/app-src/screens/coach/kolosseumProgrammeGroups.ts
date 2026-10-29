// Kolosseum programmes written for several sports are saved with the
// general activity (a programme has one activity_id), so the coach's
// library groups them by the sports their catalogue listing names instead
// (product/programmes/kolosseum_programmes_v1.mjs - pinned to it by
// test/kolosseum_programme_groups.test.mjs). A programme the coach renames
// falls back to its own activity.
import { sportLabel } from "../../utils/sportLabel";

export const KOLOSSEUM_GENERAL_PROGRAMME_SPORTS: Record<string, string[]> = {
  "Beginner full-body": [],
  "Intermediate upper/lower": [],
  "Collision off-season: forwards and linemen": ["rugby_union","rugby_league","rugby_sevens","american_football"],
  "Collision off-season: backs and skill players": ["rugby_union","rugby_league","rugby_sevens","american_football"],
  "Collision in-season maintenance": ["rugby_union","rugby_league","rugby_sevens","american_football"],
  "Field and ice off-season build": ["football_soccer","field_hockey","ice_hockey"],
  "Field and ice in-season maintenance": ["football_soccer","field_hockey","ice_hockey"],
  "Court-sport off-season build": ["netball","basketball","volleyball"],
  "Court-sport in-season maintenance": ["netball","basketball","volleyball"],
  "Run and ride strength": ["athletics","cycling"],
  "Triathlon strength": ["triathlon"],
  "Swim, row and paddle strength": ["swimming","rowing","kayaking"],
  "Endurance race-season maintenance": ["athletics","cycling","triathlon","swimming","rowing","kayaking"],
  "Combat-sport strength and power": ["boxing","muay_thai","mma","wrestling","judo","brazilian_jiu_jitsu"],
  "Fight camp strength": ["boxing","muay_thai","mma","wrestling","judo","brazilian_jiu_jitsu"],
  "Tennis off-season build": ["tennis"],
  "Tennis tournament-season maintenance": ["tennis"],
  "Cricket off-season build: batters and spinners": ["cricket"],
  "Cricket off-season: fast bowlers": ["cricket"],
  "Cricket in-season maintenance": ["cricket"],
  "Sprint and jump power": ["athletics"],
  "Throws strength and power": ["athletics"],
  "Athletics competition season": ["athletics"],
  "Collision off-season: forwards and linemen (pro)": ["rugby_union","rugby_league","rugby_sevens","american_football"],
  "Collision off-season: backs and skill players (pro)": ["rugby_union","rugby_league","rugby_sevens","american_football"],
  "Field and ice off-season build (pro)": ["football_soccer","field_hockey","ice_hockey"],
  "Court-sport off-season build (pro)": ["netball","basketball","volleyball"],
  "Tennis off-season build (pro)": ["tennis"],
  "Cricket off-season build: batters and spinners (pro)": ["cricket"],
  "Combat-sport strength and power (pro)": ["boxing","muay_thai","mma","wrestling","judo","brazilian_jiu_jitsu"],
  "Sprint and jump power (pro)": ["athletics"],
  "Run and ride strength (pro)": ["athletics","cycling"],
  "Triathlon strength (pro)": ["triathlon"],
  "Swim, row and paddle strength (pro)": ["swimming","rowing","kayaking"],
  "Contact-sport foundation (beginner)": ["rugby_union","rugby_league","rugby_sevens","american_football","boxing","muay_thai","mma","wrestling","judo","brazilian_jiu_jitsu"],
  "Field, court and racket foundation (beginner)": ["football_soccer","field_hockey","ice_hockey","netball","basketball","volleyball","cricket","tennis"],
  "Bodyweight fundamentals (based on the r/bodyweightfitness Recommended Routine)": [],
  "Novice linear 3×5 (based on Starting Strength)": [],
  "Novice 5×5 (based on StrongLifts 5×5)": [],
  "Novice linear with AMRAP sets (based on Greyskull LP)": [],
  "Wave 5s/3s/1s full body (based on 5/3/1 for Beginners)": [],
  "Tiered T1/T2/T3 progression (based on GZCLP)": [],
  "Volume, recovery and intensity days (based on the Texas Method)": [],
  "Ramping weekly 5×5 (based on Madcow 5×5)": [],
  "Wave 5s/3s/1s with 5×10 (based on 5/3/1 Boring But Big)": [],
  "Rep waves 10s, 8s, 5s, 3s (based on the Juggernaut Method)": [],
  "Three-lift strength waves (based on Tactical Barbell Operator)": [],
  "Easy strength, 40 days (based on Easy Strength)": [],
  "Power and hypertrophy upper/lower (based on PHUL)": [],
  "Power and hypertrophy, 5 days (based on PHAT)": [],
  "Push/pull/legs, 6 days (based on the Reddit PPL)": [],
  "Five-day body-part split (based on the classic bodybuilding split)": [],
  "Golden-era 6-day split (based on Arnold Schwarzenegger's split)": [],
};

// Named groups for the sport sets those programmes share.
const SPORT_SET_GROUPS: [string[], string][] = [
  [[], "Any sport"],
  [["rugby_union", "rugby_league", "rugby_sevens", "american_football"], "Rugby and American football"],
  [["football_soccer", "field_hockey", "ice_hockey"], "Football and hockey"],
  [["netball", "basketball", "volleyball"], "Netball, basketball and volleyball"],
  [["athletics", "cycling"], "Running and cycling"],
  [["swimming", "rowing", "kayaking"], "Swimming, rowing and paddling"],
  [["athletics", "cycling", "triathlon", "swimming", "rowing", "kayaking"], "Endurance sports"],
  [["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"], "Combat sports"],
  [["rugby_union", "rugby_league", "rugby_sevens", "american_football", "boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"], "Contact sports"],
  [["football_soccer", "field_hockey", "ice_hockey", "netball", "basketball", "volleyball", "cricket", "tennis"], "Field, court and racket sports"]
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));

export function sportGroupLabel(sports: string[]): string {
  const named = SPORT_SET_GROUPS.find(([set]) => sameSet(set, sports));
  if (named) return named[1];
  return sports.length === 1 ? sportLabel(sports[0]) : sports.map(sportLabel).join(", ");
}

// The heading a programme is listed under in the coach's library.
export function programmeSportGroup(template: { activity_id?: unknown; template_name?: unknown }): string {
  const activityId = String(template.activity_id ?? "");
  const sports = activityId === "general_strength" ? KOLOSSEUM_GENERAL_PROGRAMME_SPORTS[String(template.template_name ?? "")] : undefined;
  return sports ? sportGroupLabel(sports) : sportLabel(activityId);
}
