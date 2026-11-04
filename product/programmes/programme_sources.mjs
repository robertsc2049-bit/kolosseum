// The sources each Kolosseum programme is based on, shown to coaches and
// athletes as "Based on" on the programme (catalogue listing.sources). A
// recognised programme cites its original publication; where no original
// can be traced, it says so rather than inventing one. Kolosseum's own
// programmes cite the research and standard texts behind their method.
// Every citation was checked against a publisher, PubMed, library or the
// author's own page (4 Nov 2026). test/programme_sources.test.mjs requires
// every programme to have at least one.

const S = {
  // ---- standard texts and research ----
  acsm2009: { cite: "American College of Sports Medicine. Position stand: progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687-708.", url: "https://doi.org/10.1249/MSS.0b013e3181915670" },
  haff2016: { cite: "Haff GG, Triplett NT (eds). Essentials of Strength Training and Conditioning. 4th ed. NSCA / Human Kinetics; 2016." },
  helms2016: { cite: "Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J 2016;38(4):42-49.", url: "https://doi.org/10.1519/SSC.0000000000000218" },
  schoenfeld2017: { cite: "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 2017;35(11):1073-1082.", url: "https://doi.org/10.1080/02640414.2016.1210197" },
  issurin2010: { cite: "Issurin VB. New horizons for the methodology and physiology of training periodization. Sports Med 2010;40(3):189-206.", url: "https://doi.org/10.2165/11319770-000000000-00000" },
  bell2023: { cite: "Bell L, Strafford BW, Coleman M, Androulakis Korakakis P, Nolan D. Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach. Sports Med Open 2023;9:87.", url: "https://doi.org/10.1186/s40798-023-00633-0" },
  suchomel2016: { cite: "Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med 2016;46(10):1419-1449.", url: "https://doi.org/10.1007/s40279-016-0486-0" },
  ronnestad2011: { cite: "Rønnestad BR, Nymark BS, Raastad T. Effects of in-season strength maintenance training frequency in professional soccer players. J Strength Cond Res 2011;25(10):2653-2660.", url: "https://doi.org/10.1519/JSC.0b013e31822dcd96" },
  vanderhorst2015: { cite: "van der Horst N, Smits DW, Petersen J, Goedhart EA, Backx FJG. The preventive effect of the Nordic hamstring exercise on hamstring injuries in amateur soccer players: a randomized controlled trial. Am J Sports Med 2015;43(6):1316-1323.", url: "https://doi.org/10.1177/0363546515574057" },
  beattie2014: { cite: "Beattie K, Kenny IC, Lyons M, Carson BP. The effect of strength training on performance in endurance athletes. Sports Med 2014;44(6):845-865.", url: "https://doi.org/10.1007/s40279-014-0157-y" },
  ronnestadMujika2014: { cite: "Rønnestad BR, Mujika I. Optimizing strength training for running and cycling endurance performance: a review. Scand J Med Sci Sports 2014;24(4):603-612.", url: "https://doi.org/10.1111/sms.12104" },
  james2016: { cite: "James LP, Haff GG, Kelly VG, Beckman EM. Towards a determination of the physiological characteristics distinguishing successful mixed martial arts athletes: a systematic review of combat sport literature. Sports Med 2016;46(10):1525-1551.", url: "https://doi.org/10.1007/s40279-016-0493-1" },
  kovacs2007: { cite: "Kovacs MS. Tennis physiology: training the competitive athlete. Sports Med 2007;37(3):189-198.", url: "https://doi.org/10.2165/00007256-200737030-00001" },
  hulin2014: { cite: "Hulin BT, Gabbett TJ, Blanch P, et al. Spikes in acute workload are associated with increased injury risk in elite cricket fast bowlers. Br J Sports Med 2014;48(8):708-712.", url: "https://doi.org/10.1136/bjsports-2013-092524" },
  winwood2011: { cite: "Winwood PW, Keogh JWL, Harris NK. The strength and conditioning practices of strongman competitors. J Strength Cond Res 2011;25(11):3118-3128.", url: "https://doi.org/10.1519/JSC.0b013e318212daea" },
  wilson2012: { cite: "Wilson JM, Marin PJ, Rhea MR, et al. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res 2012;26(8):2293-2307.", url: "https://doi.org/10.1519/JSC.0b013e31823a3e2d" },
  pritchard2016: { cite: "Pritchard HJ, Tod DA, Barnes MJ, Keogh JW, McGuigan MR. Tapering practices of New Zealand's elite raw powerlifters. J Strength Cond Res 2016;30(7):1796-1804.", url: "https://doi.org/10.1519/JSC.0000000000001292" },
  sheiko2018: { cite: "Sheiko B. Powerlifting: Foundations and Methods. Ufa; 2018." },

  // ---- named methods a programme uses ----
  haroy2019: { cite: "Harøy J, Clarsen B, Wiger EG, et al. The Adductor Strengthening Programme prevents groin problems among male football players: a cluster-randomised controlled trial. Br J Sports Med 2019;53(3):150-157 (the Copenhagen adduction exercise).", url: "https://doi.org/10.1136/bjsports-2017-098937" },
  markovic2007: { cite: "Markovic G. Does plyometric training improve vertical jump height? A meta-analytical review. Br J Sports Med 2007;41(6):349-355.", url: "https://doi.org/10.1136/bjsm.2007.035113" },
  seitzHaff2016: { cite: "Seitz LB, Haff GG. Factors modulating post-activation potentiation of jump, sprint, throw, and upper-body ballistic performances: a systematic review with meta-analysis. Sports Med 2016;46(2):231-240 (contrast pairs).", url: "https://doi.org/10.1007/s40279-015-0415-7" },
  glassman2002: { cite: "Glassman G. What is fitness? CrossFit Journal, October 2002 (the AMRAP, EMOM and for-time formats as CrossFit uses them).", url: "https://games.crossfit.com/article/what-fitness" },
  tabata1996: { cite: "Tabata I, Nishimura K, Kouzaki M, et al. Effects of moderate-intensity endurance and high-intensity intermittent training on anaerobic capacity and VO2max. Med Sci Sports Exerc 1996;28(10):1327-1330 (the 20 s on / 10 s off protocol).", url: "https://doi.org/10.1097/00005768-199610000-00018" },
  zatsiorsky2006: { cite: "Zatsiorsky VM, Kraemer WJ. Science and Practice of Strength Training. 2nd ed. Champaign, IL: Human Kinetics; 2006 (the conjugate method)." },

  // ---- the originals behind the recognised programmes ----
  rippetoe2011: { cite: "Rippetoe M. Starting Strength: Basic Barbell Training. 3rd ed. Wichita Falls, TX: The Aasgaard Company; 2011." },
  rippetoeBaker2014: { cite: "Rippetoe M, Baker A. Practical Programming for Strength Training. 3rd ed. Wichita Falls, TX: The Aasgaard Company; 2014 (the Texas Method)." },
  stronglifts: { cite: "Hadim M. StrongLifts 5×5 (stronglifts.com).", url: "https://stronglifts.com/stronglifts-5x5/workout-program/" },
  sheaffer2012: { cite: "Sheaffer J. The Greyskull LP. 2nd ed. Villain Publishing; 2012." },
  bwfRR: { cite: "r/bodyweightfitness. The Recommended Routine (subreddit wiki, since 2012).", url: "https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/" },
  wendler2017: { cite: "Wendler J. 5/3/1 Forever: Simple and Effective Programming for Size, Speed and Strength. Jim Wendler LLC; 2017." },
  gzclp: { cite: "Lefever C (u/gzcl). GZCLP - the GZCL linear progression (2016; the GZCL Method compendium)." },
  starr1976: { cite: "Starr B. The Strongest Shall Survive: Strength Training for Football. 1976 (the 5×5 that the Madcow ramping version adapts)." },
  smith2012: { cite: "Smith CW. The Juggernaut Method 2.0: Strength, Speed and Power for Every Athlete. Juggernaut Training Systems; 2012." },
  black2014: { cite: "Black K. Tactical Barbell: Definitive Strength Training for the Operational Athlete. 2014 (the Operator template)." },
  johnTsatsouline2011: { cite: "John D, Tsatsouline P. Easy Strength. Dragon Door Publications; 2011." },
  phul: { cite: "Campbell B. PHUL: Power Hypertrophy Upper Lower (Muscle & Strength).", url: "https://www.muscleandstrength.com/workouts/phul-workout" },
  phat: { cite: "Norton L. PHAT: Power Hypertrophy Adaptive Training (biolayne.com).", url: "https://biolayne.com/articles/training/phat-power-hypertrophy-adaptive-training/" },
  ppl: { cite: "u/Metallicadpa. A linear progression based PPL program for beginners. r/Fitness, 2015." },
  schwarzenegger1998: { cite: "Schwarzenegger A, Dobbins B. The New Encyclopedia of Modern Bodybuilding. New York: Simon & Schuster; 1998." },
  poliquinGVT: { cite: "Poliquin C. German Volume Training. First published in Muscle Media 2000 magazine, mid-1990s; the exact issue isn't traceable." },
  smolov: { cite: "Attributed to Sergey Smolov. No original publication can be traced; the routine is known from later English-language accounts, and the attribution itself is disputed." },
  simmons2007: { cite: "Simmons L. The Westside Barbell Book of Methods. Westside Barbell; 2007." },
  bulgarian: { cite: "After Ivan Abadjiev, Bulgarian national weightlifting coach 1968-1989. Abadjiev published no programme of his own; the method is known from secondary accounts." }
};

const own = (...keys) => keys.map((key) => S[key]);
// Families of Kolosseum's own programmes.
const GENERAL = own("acsm2009", "haff2016", "helms2016", "bell2023");
const TEAM_OFF = own("suchomel2016", "haff2016", "issurin2010", "vanderhorst2015");
const TEAM_IN = own("ronnestad2011", "suchomel2016", "haff2016");
const ENDURANCE = own("beattie2014", "ronnestadMujika2014", "wilson2012");
const COMBAT = own("james2016", "suchomel2016", "haff2016");
const TENNIS = own("kovacs2007", "suchomel2016", "haff2016");
const CRICKET = own("suchomel2016", "hulin2014", "haff2016");
const ATHLETICS = own("suchomel2016", "haff2016", "issurin2010", "vanderhorst2015");
const MEET_PREP = own("issurin2010", "pritchard2016", "helms2016", "haff2016");

export const PROGRAMME_SOURCES = {
  beginner_full_body: own("acsm2009", "haff2016", "helms2016"),
  intermediate_upper_lower: [...GENERAL, S.schoenfeld2017],
  powerlifting_meet_prep: [...MEET_PREP, S.sheiko2018],
  collision_forwards_off_season: TEAM_OFF,
  collision_backs_off_season: TEAM_OFF,
  collision_in_season: TEAM_IN,
  field_ice_off_season: TEAM_OFF,
  field_ice_in_season: TEAM_IN,
  court_off_season: TEAM_OFF,
  court_in_season: TEAM_IN,
  endurance_run_ride_strength: ENDURANCE,
  triathlon_strength: ENDURANCE,
  endurance_swim_row_paddle_strength: ENDURANCE,
  endurance_in_season: [...ENDURANCE, S.ronnestad2011],
  combat_strength_power: COMBAT,
  combat_fight_camp: COMBAT,
  tennis_off_season: TENNIS,
  tennis_in_season: [...TENNIS, S.ronnestad2011],
  cricket_off_season: CRICKET,
  cricket_fast_bowler_off_season: CRICKET,
  cricket_in_season: [...CRICKET, S.ronnestad2011],
  athletics_power_build: ATHLETICS,
  athletics_throws_build: ATHLETICS,
  athletics_competition_season: [...ATHLETICS, S.ronnestad2011],
  strongman_strength_events: own("winwood2011", "haff2016", "issurin2010"),
  street_lifting_meet_prep: MEET_PREP,
  hyrox_race_build: own("wilson2012", "beattie2014", "haff2016"),
  crossfit_strength_conditioning: own("wilson2012", "haff2016", "helms2016"),
  olympic_weightlifting_meet_prep: own("issurin2010", "haff2016", "helms2016"),
  beginner_contact_foundation: own("acsm2009", "suchomel2016", "haff2016"),
  beginner_field_court_foundation: own("acsm2009", "suchomel2016", "haff2016"),
  beginner_weightlifting_foundation: own("acsm2009", "haff2016"),
  beginner_street_lifting_foundation: own("acsm2009", "haff2016"),
  beginner_crossfit_on_ramp: own("acsm2009", "wilson2012", "haff2016"),
  beginner_hyrox_first_race: own("acsm2009", "wilson2012", "haff2016"),
  beginner_grip_sport_foundation: own("acsm2009", "haff2016"),
  grip_sport_meet_prep: MEET_PREP,

  // Recognised programmes: the original first.
  novice_linear_3x5: own("rippetoe2011"),
  novice_5x5: own("stronglifts"),
  novice_amrap_linear: own("sheaffer2012"),
  bodyweight_fundamentals: own("bwfRR"),
  wave_531_full_body: own("wendler2017"),
  wave_531_bbb: own("wendler2017"),
  tiered_linear: own("gzclp"),
  texas_method: own("rippetoeBaker2014"),
  ramping_5x5: own("starr1976"),
  rep_waves: own("smith2012"),
  three_lift_waves: own("black2014"),
  easy_strength_40_day: own("johnTsatsouline2011"),
  power_hypertrophy_upper_lower: own("phul"),
  power_hypertrophy_5_day: own("phat"),
  push_pull_legs_6_day: own("ppl"),
  body_part_split_5_day: [{ cite: "The traditional bodybuilding body-part split, with no single originator." }, S.schwarzenegger1998],
  golden_era_6_day: own("schwarzenegger1998"),
  ten_sets_of_ten: own("poliquinGVT"),
  smolov_squat_pro: own("smolov"),
  smolov_jr_pro: own("smolov"),
  competition_lift_volume: own("sheiko2018"),
  max_effort_dynamic_effort: own("simmons2007"),
  bulgarian_daily_max_pro: own("bulgarian")
};

// Named methods: whatever a programme contains cites where the method comes
// from, so a programme with Copenhagen adductions cites the trial behind
// them, one with contrast pairs the research on them, and so on.
const METHODS = [
  { test: /copenhagen/iu, source: S.haroy2019 },
  { test: /nordic/iu, source: S.vanderhorst2015 },
  { test: /plyometric|bound|depth_jump|box_jump|hurdle_hop|pogo/iu, source: S.markovic2007 },
  { test: /contrast/iu, source: S.seitzHaff2016 },
  { test: /"type":"(?:amrap|emom|for_time)"/u, source: S.glassman2002 },
  { test: /tabata/iu, source: S.tabata1996 },
  { test: /conjugate|max effort|dynamic effort/iu, source: S.zatsiorsky2006 }
];

// A programme's sources: its own (or its base programme's, for a pro
// version), then the source of each named method it uses.
export function sourcesFor(programme) {
  const key = typeof programme === "string" ? programme : programme.key;
  const own = PROGRAMME_SOURCES[key] ?? PROGRAMME_SOURCES[String(key).replace(/_pro$/u, "")] ?? [];
  if (typeof programme === "string") return own;
  const body = JSON.stringify(programme.blocks ?? []);
  const methods = METHODS.filter((method) => method.test.test(body)).map((method) => method.source);
  return [...new Set([...own, ...methods])].slice(0, 12);
}

// Method references for programmes Kolosseum builds on request (quick build
// and the Kolosseum starter), by what they're for.
export const BUILT_PROGRAMME_SOURCES = own("acsm2009", "haff2016", "helms2016", "bell2023");
