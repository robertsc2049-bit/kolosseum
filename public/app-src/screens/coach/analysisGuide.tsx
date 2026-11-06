import React from "react";

// Plain-English explanations for every part of the coach's Analysis page and
// progress reports: what it shows, how to read it, how it's worked out and
// what to keep in mind. One place, so the page and the reports say the same
// thing about the same number. Shown folded under "What this means".
//
// Kolosseum states facts and explains how to read them; it doesn't tell the
// coach what to do. Where a line rests on published research it says so with
// author and year, and the entry lists the full source (SOURCES, each checked
// against the publisher or PubMed record).

export const SOURCES = {
  foster2001: { cite: "Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. J Strength Cond Res 2001;15(1):109-115.", url: "https://doi.org/10.1519/00124278-200102000-00019" },
  foster1998: { cite: "Foster C. Monitoring training in athletes with reference to overtraining syndrome. Med Sci Sports Exerc 1998;30(7):1164-1168.", url: "https://pubmed.ncbi.nlm.nih.gov/9662690/" },
  gabbett2016: { cite: "Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med 2016;50(5):273-280.", url: "https://doi.org/10.1136/bjsports-2015-095788" },
  hulin2014: { cite: "Hulin BT, Gabbett TJ, Blanch P, et al. Spikes in acute workload are associated with increased injury risk in elite cricket fast bowlers. Br J Sports Med 2014;48(8):708-712.", url: "https://doi.org/10.1136/bjsports-2013-092524" },
  impellizzeri2020: { cite: "Impellizzeri FM, Tenan MS, Kempton T, et al. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform 2020;15(6):907-913.", url: "https://doi.org/10.1123/ijspp.2019-0864" },
  lolli2019: { cite: "Lolli L, Batterham AM, Hawkins R, et al. Mathematical coupling causes spurious correlation within the conventional acute-to-chronic workload ratio calculations. Br J Sports Med 2019;53(15):921-922.", url: "https://bjsm.bmj.com/content/53/15/921" },
  zourdos2016: { cite: "Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res 2016;30(1):267-275.", url: "https://doi.org/10.1519/JSC.0000000000001049" },
  helms2016: { cite: "Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J 2016;38(4):42-49.", url: "https://doi.org/10.1519/SSC.0000000000000218" },
  borg1982: { cite: "Borg GA. Psychophysical bases of perceived exertion. Med Sci Sports Exerc 1982;14(5):377-381.", url: "https://doi.org/10.1249/00005768-198205000-00012" },
  epley1985: { cite: "Epley B. Poundage chart. Boyd Epley Workout. Lincoln, NE: Body Enterprises; 1985 (the Epley formula; not peer-reviewed)." },
  lesuer1997: { cite: "LeSuer DA, McCormick JH, Mayhew JL, et al. The accuracy of prediction equations for estimating 1-RM performance in the bench press, squat, and deadlift. J Strength Cond Res 1997;11(4):211-213." },
  tuchscherer2008: { cite: "Tuchscherer M. The Reactive Training Manual. Reactive Training Systems; 2008 (the RTS RPE chart)." },
  schoenfeld2017: { cite: "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci 2017;35(11):1073-1082.", url: "https://doi.org/10.1080/02640414.2016.1210197" },
  haff2016: { cite: "Haff GG, Triplett NT (eds). Essentials of Strength Training and Conditioning. 4th ed. NSCA / Human Kinetics; 2016." },
  pareja2017: { cite: "Pareja-Blanco F, Rodríguez-Rosell D, Sánchez-Medina L, et al. Effects of velocity loss during resistance training on athletic performance, strength gains and muscle adaptations. Scand J Med Sci Sports 2017;27(7):724-735.", url: "https://doi.org/10.1111/sms.12678" },
  plews2013: { cite: "Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. Sports Med 2013;43(9):773-781.", url: "https://doi.org/10.1007/s40279-013-0071-8" },
  saw2016: { cite: "Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med 2016;50(5):281-291.", url: "https://doi.org/10.1136/bjsports-2015-094758" },
  fuller2006: { cite: "Fuller CW, Ekstrand J, Junge A, et al. Consensus statement on injury definitions and data collection procedures in studies of football (soccer) injuries. Br J Sports Med 2006;40(3):193-201.", url: "https://doi.org/10.1136/bjsm.2005.025270" },
  bahr2020: { cite: "Bahr R, Clarsen B, Derman W, et al. International Olympic Committee consensus statement: methods for recording and reporting of epidemiological data on injury and illness in sport 2020. Br J Sports Med 2020;54(7):372-389.", url: "https://doi.org/10.1136/bjsports-2019-101969" },
  hopkins2004: { cite: "Hopkins WG. How to interpret changes in an athletic performance test. Sportscience 2004;8:1-7.", url: "https://sportsci.org/jour/04/wghtests.htm" },
  duhig2016: { cite: "Duhig S, Shield AJ, Opar D, et al. Effect of high-speed running on hamstring strain injury risk. Br J Sports Med 2016;50(24):1536-1540.", url: "https://doi.org/10.1136/bjsports-2015-095679" },
  visnes2013: { cite: "Visnes H, Bahr R. Training volume and body composition as risk factors for developing jumper's knee among young elite volleyball players. Scand J Med Sci Sports 2013;23(5):607-613." },
  acsm2009: { cite: "American College of Sports Medicine. Position stand: progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687-708.", url: "https://doi.org/10.1249/MSS.0b013e3181915670" },
  laputin1982: { cite: "Laputin NP, Oleshko VG. Managing the Training of Weightlifters. Kiev: Zdorov'ya; 1982 (English translation: Sportivny Press) - reports A.S. Prilepin's table of reps per intensity zone." },
  bangsbo2008: { cite: "Bangsbo J, Iaia FM, Krustrup P. The Yo-Yo intermittent recovery test: a useful tool for evaluation of physical performance in intermittent sports. Sports Med 2008;38(1):37-51.", url: "https://doi.org/10.2165/00007256-200838010-00004" },
  draper1985: { cite: "Draper JA, Lancaster MG. The 505 test: a test for agility in the horizontal plane. Aust J Sci Med Sport 1985;17(1):15-18." },
  kelly2013: { cite: "Kelly VG, Wood A. The 1.2 km shuttle (Bronco) test in rugby players. Presented at the Australian Strength and Conditioning Association conference, 2013 - the test has no peer-reviewed original publication." },
} as const satisfies Record<string, { cite: string; url?: string }>;

export type SourceId = keyof typeof SOURCES;

export type GuideEntry = Readonly<{
  title: string;
  shows: string;
  read: readonly string[];
  how: readonly string[];
  mind?: readonly string[];
  sources?: readonly SourceId[];
}>;

export const GUIDE: Readonly<Record<string, GuideEntry>> = {
  roster: {
    title: "Athletes by flags",
    shows: "Every athlete you coach over the last 8 weeks, sorted by their flags, most first.",
    read: [
      "Red flag: at least one serious flag - for example recurring pain, a main lift down 5% or more, readiness far below their normal, or fewer than 7 in 10 planned sessions done.",
      "Amber flag: something outside their normal range - load rising quickly, a lift stalling, effort creeping up, a dip in wellbeing.",
      "No flags: nothing is outside the rules described on this page.",
      "Sessions: planned sessions done in their latest complete week. Load: this week's training load against their own last 4 weeks (1.0 = the same; 0.8-1.3 is the range most often quoted as normal (Gabbett 2016), a contested measure (Impellizzeri 2020)). Readiness: Normal, or Low when their pre-session check-ins are well below their own usual. Main lifts: ↑ rising, · steady, → plateau (no new best for 6+ weeks), ↓ falling. Load and Readiness turn amber or red when they are outside the athlete's normal."
    ],
    how: [
      "Each athlete is scored from their flags: a red flag counts 3, an amber flag counts 1. The list is sorted by that score, highest first.",
      "Everything is worked out from what the athlete logged - sets, reps, weights, effort ratings, readiness check-ins, weekly check-ins and pain reports. Nothing is entered by hand."
    ],
    mind: [
      "An athlete who logs little will show no flags because there is little to flag. Check the Sessions column alongside the status.",
      "A flag means a number is outside the rule described here. It is not a judgement on the athlete, and what to do about it is your call."
    ],
    sources: ["gabbett2016", "impellizzeri2020"]
  },
  summary: {
    title: "What stands out",
    shows: "The most important things in this athlete's data, most urgent first, in one sentence each.",
    read: [
      "The top 5 show first - the most serious first (pain, then strength, readiness, load, turning up, doing the plan). 'Show all' lists the rest.",
      "Where there is published research on that kind of signal, it's summarised under the finding with the author and year. The full sources are under each section's 'What this means'.",
      "Related signals are joined into one line - for example a big week followed by a drop, or a lift that's stalling while it also feels harder.",
      "Red flag: the furthest outside the athlete's normal, by the rules in each section.",
      "Amber flag: outside their normal, by less.",
      "Green - going well: progress, such as a lift rising beyond its normal variation.",
      "Each section below starts with its own headline from this list, then shows the chart and the numbers behind it."
    ],
    how: ["Each section runs its own checks (described in that section's 'What this means'). Every check that fires adds one line here, sorted red, then amber, then green."],
    mind: ["'This week' is never complete until Sunday, so load and execution flags use the last complete week. Readiness uses the latest check-ins, including this week's."]
  },
  strength: {
    title: "Strength",
    shows: "How strong the athlete is on each of their main lifts, week by week, as an estimated one-rep max worked out from the sets they logged - no max testing needed.",
    read: [
      "A rising line means their estimated max is going up. Small dips in heavy or deload weeks are common.",
      "Real change only: every lift wobbles week to week (a good day, a bad night's sleep). Each lift's own normal variation is measured, and Rising or Falling needs a change bigger than 1.5× that wobble (never under 2%). The lift list shows the wobble as '±x% is normal week-to-week variation'.",
      "× bodyweight is the estimated max divided by their latest bodyweight - the number weight-class and team-sport coaches compare (e.g. a 1.8× bodyweight squat). The tested max is the latest max in their strength profile, next to the estimate: a big gap means the recorded max and the estimate disagree.",
      "Rising: up by more than the smallest worthwhile change on their best from at least 4 weeks earlier. Steady: within that. Plateau: no new best for 6 weeks or more while still training the lift. Falling: their last 2 weeks are 5% or more below their peak, or down 5% or more in 4 weeks.",
      "Main lifts are the ones you marked as the primary lift in a session. Accessories are listed in the numbers for reference but are never flagged - an accessory kept at one weight on purpose isn't a plateau."
    ],
    how: [
      "From every logged set of 1-10 reps with a weight. If the athlete rated the exercise with an RPE between 6 and 10, the heaviest set uses the RTS (Tuchscherer) RPE chart: weight ÷ the chart's percentage for those reps at that RPE. Those weeks are marked ʳ in the table. Every other set uses Epley: weight × (1 + reps ÷ 30).",
      "Each week shows the single best estimate that week. Hover a point or table cell to see the set it came from."
    ],
    mind: [
      "An estimate, not a tested max. It is most accurate from sets of 1-5 reps and honest RPE ratings; sets of 8-10 reps tend to over- or under-estimate.",
      "Only an RPE rating feeds the RTS chart (it is built on reps in reserve). Borg and CR10 ratings still count for effort and load, but those sets use Epley.",
      "Bodyweight exercises (pull-ups, dips, push-ups) have no estimated max from unweighted sets - their own chart shows the best set in reps each week instead. A weighted set (for example a pull-up with 20 kg) counts the added weight only.",
      "Prilepin's range: a note appears when 2 or more recent sessions logged more total reps at 70% of max or above than Prilepin's table lists for that zone (Laputin & Oleshko 1982). The table records what Soviet weightlifters did in the 1970s, mostly in the snatch, clean and jerk - a description of practice, not a controlled study - so it is shown as a note, never a flag."
    ],
    sources: ["epley1985", "lesuer1997", "tuchscherer2008", "zourdos2016", "laputin1982"]
  },
  execution: {
    title: "Doing the plan",
    shows: "Whether the athlete does the sessions as you wrote them: the sets, the reps, the weights - and whether the same weight is starting to feel harder.",
    read: [
      "Reps hit: of the sets they logged, how many reached at least the prescribed reps (the bottom of a rep range). 90% or more is typical.",
      "Sets logged: of the sets you prescribed, how many they logged. Below about 85% means some prescribed sets weren't logged - often the last exercises of a session.",
      "Load vs plan (in the numbers): their weight against the weight you prescribed - a fixed weight, a weight range, or a % of max made a weight. Anywhere inside a range is on plan (0); above it is measured from the top, below it from the bottom. + means heavier than planned.",
      "Effort against the target you set (in the numbers): where you prescribed by RPE, Borg or CR10, their rating of that exercise against your target, in the same scale. Rated 1 RPE (or 1.4 Borg) or more above target over several sessions means they rated it harder than your target; 1.5 or more below means they rated it easier.",
      "Timed and distance work (planks, carries, sprints, rows, sled pushes) is done by completing it rather than set by set: completing it counts all its prescribed sets as done, skipping it counts them as missed.",
      "Feels harder at the same weight: the same exercise at about the same top weight, rated in the first half of the period and again in the second. A rise of 1 RPE or more means fewer reps were left in reserve at the same weight than before.",
      "Most often short of the plan: the exercises where they most often fall short on sets or reps."
    ],
    how: [
      "Only working sets (not warm-ups or cool-downs) of sessions marked done or part done.",
      "Effort comparison: top weights within 2.5% of each other count as 'the same weight', rated in the same scale (RPE, Borg or CR10).",
      "Reps hit only applies where reps were prescribed; bodyweight sets are checked on reps like any other."
    ],
    mind: [
      "If the athlete doesn't rate exercises, the effort comparisons can't be made. Ask them to rate the hardest set of each exercise.",
      "Where the athlete chooses their own weights (no prescribed weight), there is no load to compare - reps and effort still are."
    ],
    sources: ["zourdos2016", "helms2016"]
  },
  testing: {
    title: "Testing",
    shows: "The tests you record for the athlete - jumps, sprints, agility, conditioning, grip - with their latest result, the change since last time, their best, and whether the change is real.",
    read: [
      "Real improvement / Real decline: the change since the previous result is bigger than the test's smallest worthwhile change. Within normal variation: it isn't - the athlete may have improved, or it may be a good or bad day; a retest shows which.",
      "Smallest worthwhile changes used: CMJ and squat jump 1.5 cm, broad jump 5 cm, 10 m sprint 0.03 s, 20 m 0.04 s, 40 m 0.06 s, 505 0.05 s, Yo-Yo IR1 40 m, Bronco 5 s, 2 km row 3 s, grip 2 kg, pull-ups 1 rep. Hover a verdict to see it.",
      "Test in the same conditions each time - same warm-up, surface, time of day, and not the day after a hard session - or the change measures the conditions, not the athlete.",
      "The tests follow their published protocols: Yo-Yo IR1 (Bangsbo 2008), the 505 (Draper & Lancaster 1985) and the Bronco 1.2 km shuttle (Kelly & Wood 2013)."
    ],
    how: [
      "Record a result with the form below the table; remove a wrong one with ×. Results are kept on the athlete's record, with who recorded them.",
      "Lower is better for times (sprints, 505, Bronco, 2 km row); higher for the rest."
    ],
    mind: ["The smallest worthwhile changes are typical values for trained athletes. With a squad of 10 or more, the team view works out your own squad's (0.2 × the spread between athletes)."],
    sources: ["hopkins2004", "bangsbo2008", "draper1985", "kelly2013"]
  },
  intensity: {
    title: "Intensity (% of max)",
    shows: "How heavy the athlete's lifting was relative to their max, where your programme sets weights as a % of max: the share of sets in each zone, and the average % they lifted each week.",
    read: [
      "Under 60%: technique, speed and warm-up work. 60-70%: volume and hypertrophy. 70-80%: the core of most strength work. 80-90%: heavy strength. 90% and over: near-maximal - singles, doubles and peaking.",
      "Strength and conditioning texts describe volume phases mostly at moderate percentages and peaking phases at higher ones. Compare the zones with the block you wrote.",
      "If the average % is well above what you prescribed, the athlete is going heavier than planned - check Doing the plan."
    ],
    how: [
      "Each logged set's weight ÷ the max your % was worked out from (the max recorded in the athlete's strength profile when the session was made). Zones count sets.",
      "Only sets prescribed as a % of max are included - fixed weights, RPE targets and bodyweight work have no max to compare against."
    ],
    mind: ["The % is against the recorded max. If the athlete has got stronger since it was recorded, the real % is lower - update their max."],
    sources: ["haff2016"]
  },
  load: {
    title: "Training load",
    shows: "How much total work the athlete did each week - combining how hard it felt with how long it took - and whether this week is a big jump from what they're used to.",
    read: [
      "Weekly load: higher bars are harder weeks, split into gym and sport (team practice, matches, conditioning the athlete logs). For a team-sport athlete the sport bar is usually the bigger one - a 'quiet' gym week can still be a heavy week.",
      "Letters on the charts mark the weeks with a Competition (C), Match (M), Deload (D), Peak block (P) or Season start/end (S) - hover for the detail. Read the trend against them - for example the drop you planned for a deload or before a competition.",
      "Load ratio (acute:chronic): this week against their average of the 4 weeks before. 1.0 means the same as usual. 0.8-1.3 (the shaded band) is normal week-to-week variation; above 1.3 is a big jump and above 1.5 a spike. In team-sport studies, spikes were associated with more injuries the following week (Gabbett 2016; Hulin 2014). Other researchers argue the ratio is statistically flawed and shouldn't be read as one person's injury risk (Impellizzeri 2020; Lolli 2019). Below 0.8 is a drop, as in a deload or a taper.",
      "Monotony (in the numbers): how similar the days of the week are. Above 2 means the days carried similar load, with no easy days.",
      "Strain (in the numbers): weekly load × monotony. Foster found illness in athletes often followed weeks of high strain (Foster 1998)."
    ],
    how: [
      "Session load (Foster's session-RPE method) = session effort × minutes, in load points (the research calls them arbitrary units, AU). Measured: the athlete rates the whole session (0-10) and says how long it took when they finish it. Estimated, if they don't: the average of their exercise ratings × the minutes from starting the session to the last thing they logged (capped at 4 hours). The Load section says how many sessions were measured.",
      "Practice, matches and conditioning the athlete logs add their own effort × minutes.",
      "Load ratio = this week's load ÷ the mean of the 4 previous weeks' loads. Monotony = the week's average daily load ÷ the standard deviation of its 7 daily loads (rest days count as 0). Strain = weekly load × monotony."
    ],
    mind: [
      "Sessions with no effort ratings add no load, and practice or matches the athlete doesn't log are missing - both make a week look lighter than it was.",
      "The load ratio is a guide, not a prediction: research disagrees on how well it predicts injury. Use it with what the athlete tells you."
    ],
    sources: ["foster2001", "foster1998", "gabbett2016", "hulin2014", "impellizzeri2020", "lolli2019"]
  },
  adherence: {
    title: "Turning up",
    shows: "How many of their planned sessions the athlete actually did each week, which days they train on, and which exercises they skip.",
    read: [
      "90-100%: training as planned. 70-90%: most planned sessions done. Under 70%: fewer than 7 in 10 planned sessions done.",
      "Days of the week: when they actually train. Useful when planning which day gets the hardest session.",
      "Most skipped exercises (in the numbers), with the reason the athlete gave - for example equipment, pain or time."
    ],
    how: [
      "Sessions done ÷ the training days per week in their plan. A part-done session counts as half. Extra sessions never take a week above 100%.",
      "Counted from the week of their first session, so a new athlete isn't shown as missing weeks before they started. This week isn't scored until it ends.",
      "Not done: a session that was created but not finished 2 days later."
    ],
    mind: ["It depends on the training days set in their plan. If those are wrong, the percentage is too."]
  },
  readiness: {
    title: "Readiness and wellbeing",
    shows: "How the athlete feels: their quick check-in before sessions (sleep, soreness, stress) and their weekly check-in (energy, motivation, sleep).",
    read: [
      "Daily readiness is out of 15 (each of sleep, soreness and stress from 1 poor to 5 great). What matters is the drop from their own normal, not the number itself - some athletes always score 9, some always 13.",
      "Low: a week clearly below their own usual. Well below (red flag): at least 1.5 of their usual swings below their average.",
      "Weekly check-ins: a fall of 1.5 points or more in energy, motivation or sleep is flagged.",
      "Optional extras the athlete can add: tiredness and mood (1-5), resting heart rate and HRV from a watch or strap. HRV and resting heart rate are compared with their own 28-day normal, as in published athlete monitoring (Plews 2013).",
      "Self-reported wellbeing has tracked changes in training load more consistently than commonly used objective measures (Saw 2016)."
    ],
    how: [
      "Each check-in is compared with the same athlete's previous 28 days as a z-score: how many 'normal swings' away from their average it is. Low = a week averaging -1 or lower; well below = -1.5 or lower. It needs 5 earlier check-ins before it can tell.",
      "Weekly check-ins: the last 2 weeks against their earlier weeks in the period.",
      "HRV: the natural log of the reading (HRV is skewed) against their previous 28 days as a z-score; a week averaging -1.5 or lower is flagged. Resting heart rate: 5+ bpm above their 28-day average is flagged. Both need 5 earlier readings."
    ],
    mind: ["HRV and resting heart rate only compare well when taken the same way each time - first thing in the morning, same device.", "Readiness is only as good as the check-ins. Encourage honest answers - a low score is useful information, not a failure."],
    sources: ["saw2016", "plews2013"]
  },
  velocity: {
    title: "Bar speed",
    shows: "How fast the bar moves, for athletes who log it from a velocity (VBT) device: speed at the same weight over time and how much speed they lose across their sets.",
    read: [
      "Faster at the same weight is consistent with getting stronger; slower can reflect fatigue.",
      "Speed lost within sets: in an 8-week squat study, stopping at a 20% loss gave similar strength gains to 40% with fewer reps, while 40% gave more thigh muscle growth (Pareja-Blanco 2017)."
    ],
    how: ["Athletes switch on \"Log bar speed\" on their set logger and type the mean velocity their device shows for each set."],
    mind: ["Different devices read differently - compare an athlete with themselves on the same device, not with others."],
    sources: ["pareja2017"]
  },
  injuries: {
    title: "Injuries",
    shows: "The athlete's injury log: each injury, how it happened, whether it stopped them training, days lost and how they're coming back.",
    read: [
      "Days lost: days out of training, from the injury to their return. Days on modified training are shown separately.",
      "Severity uses the bands in the sports-injury consensus statements: minimal 1-3 days lost, mild 4-7, moderate 8-28, severe over 28 (Fuller 2006).",
      "A recurrence - the same place and side within 2 months of returning - is flagged, as defined in the same consensus statements (Fuller 2006; Bahr 2020).",
      "Pain reported in the same place as an injury they've come back from in the last 8 weeks is flagged too."
    ],
    how: [
      "Record an injury with where, which side, what type, how and where it happened, and whether they're out or on modified training. Move it on (out -> modified -> back to full training) as they come back.",
      "For a team, the head coach sees injuries per 1000 training hours and days lost per 1000 hours (injury burden) - training hours are the sessions and other training they logged."
    ],
    mind: [
      "Record what their physio or doctor has said - this log never gives medical advice, and stores no diagnosis or notes.",
      "Only the athlete's own coach and a team's head coach see it. Other coaches and the organisation see only whether they're available.",
      "Logging an injury doesn't stop sessions being set. For that - and always for a head injury - record a stand-down."
    ],
    sources: ["fuller2006", "bahr2020"]
  },
  gps: {
    title: "Running load (GPS / HR)",
    shows: "What the athlete did on the pitch or court, from your GPS or heart-rate system's exports: distance, high-speed running (HSR), sprint distance, player load and heart rate, week by week.",
    read: [
      "High-speed running (HSR): in elite Australian football, large rises above a player's usual were associated with hamstring strains (Duhig 2016).",
      "HSR vs usual: this week against the average of the 4 weeks before. 0.8-1.3× is a normal range; above 1.5× is flagged."
    ],
    how: [
      "Import a CSV from Catapult, STATSports, Polar, Garmin or similar under Squad entry > Import GPS / HR. Match the columns once (they are guessed for you), check the preview, then import.",
      "Rows are matched to athletes by email first, then by name. The same session imported twice is only kept once.",
      "Weekly totals are summed; average heart rate is averaged."
    ],
    mind: ["Speed thresholds for 'high speed' and 'sprint' differ between systems and settings - keep yours the same across the season so weeks compare.", "This is kept separate from effort-based load (minutes × effort), so a session isn't counted twice."],
    sources: ["duhig2016"]
  },
  squad_entry: {
    title: "Squad entry",
    shows: "Getting a whole squad's data in at once: a team session's effort for everyone, a test day's results, or a GPS / heart-rate export.",
    read: [
      "Squad session: set the date, what it was and how long, then each athlete's effort (0-10). Leave someone blank if they didn't train. Each one is added to that athlete's own record as other training.",
      "Test day: pick the test, then type each athlete's result. Only your own athletes.",
      "Import GPS / HR: choose the export file, check the column matching and the preview, then import."
    ],
    how: ["Each athlete's entry is saved on their own record and feeds their load, testing and analysis exactly as if they'd logged it. Sending the same thing twice doesn't double it."],
    mind: ["As a team's head coach you can record sessions and GPS for the whole team; test results stay with each athlete's own coach."]
  },
  pain: {
    title: "Pain",
    shows: "Pain the athlete reported during sessions, by body area and week, and whether it started in a week where load jumped.",
    read: [
      "The same area in 2 or more different weeks is flagged.",
      "'First reported in a week at 2.5× normal load' means the pain was first reported in a week where training load was well above their usual."
    ],
    how: ["Every pain report logged during a session, grouped by the area the athlete chose, with the exercise they reported it on."],
    mind: ["This is what the athlete reported. It is not a diagnosis - Kolosseum never diagnoses. Pain that persists or worsens needs a medical professional."]
  },
  volume: {
    title: "Volume",
    shows: "How much work the athlete did: sets logged each week and total weight lifted (tonnage), and hard sets per muscle group against the usual weekly range for their level.",
    read: [
      "Compare the weekly sets with the plan you wrote. Turning up shows whether a fall in sets came from missed sessions.",
      "Per muscle group: hard sets against Kolosseum's guide ranges for their level. In a meta-analysis, more weekly sets per muscle were associated with more muscle growth (Schoenfeld 2017). Being under or over can be intended - a runner's chest, a planned overreach."
    ],
    how: [
      "Every logged set, planned and extra. Tonnage = reps × weight, added up across every set.",
      "Sets per muscle group: each logged set of strength work counts in full for every group the exercise targets and as half a set for each group only its secondary muscles reach - the same count as the programme builder. Jumps, sprints, throws, Olympic lifts, carries and conditioning don't count. Planned is the sets prescribed in that week's sessions.",
      "Kolosseum's guide ranges (sets a week) by level: Beginner chest 6-16, back 6-18, quads 6-16, hamstrings 4-12; Amateur chest 8-22, back 10-24, quads 8-22, hamstrings 6-20; Pro chest 10-26, back 12-28, quads 10-26, hamstrings 8-24. Glutes and lower back run higher (they get a full set from many compound lifts), and so do shoulders (front, side and rear delts together); smaller groups have a maximum only. A sport's focus groups (a grip athlete's forearms, a weightlifter's legs) have no maximum.",
      "Bodyweight reps: the reps of sets logged with no weight added (they add nothing to tonnage). Timed and distance work: sets × the prescribed time or distance, counted once the athlete completes it."
    ],
    mind: ["Tonnage favours heavy lower-body lifts, so compare weeks with each other rather than exercises with each other.", "Timed and distance work is counted as prescribed: the athlete marks it done rather than logging their actual time or distance."],
    sources: ["schoenfeld2017"]
  },

  team: {
    title: "Team analysis",
    shows: "Every athlete in the team over the last 8 weeks, summed up as a group - so you can see whether something is happening to one athlete or to the whole squad.",
    read: [
      "Group findings count athletes: '3 athletes of 7 had a big jump in training load' means the group, not one person.",
      "Sessions done and Load vs usual are averages across the athletes who trained. Big jumps count athletes over 1.3× their own usual load; Low readiness counts athletes well below their own normal.",
      "By position and By coach show the same numbers per group - for example whether it's the forwards or the backs carrying the load.",
      "Every athlete lists the whole team. Your own athletes open in full. A teammate's detail stays with their own coach: their pain shows only as 'recurring pain reported', never the area. The team's head coach (named by the organisation's owner) can open every athlete in full.",
      "Available today: Unavailable is an active stand-down (for example after a head injury), Modified is an active pain flag (they train around it), Available is neither. The reason shows on hover for your own athletes - or all of them, as head coach.",
      "Squad testing puts every athlete's latest result side by side, best first: percentile is their rank in the squad (100 = best) and 'vs position' compares them with their position group. With 10 or more tested, the smallest worthwhile change is worked out from your own squad (0.2 × the spread between athletes).",
      "Download squad (CSV) gives the table as a spreadsheet - status, availability, sessions, load, readiness, main lifts with × bodyweight, and every test - for staff meetings and selection."
    ],
    how: [
      "Each athlete is analysed exactly as on their own page (last 8 weeks), then the group's numbers are counted and averaged.",
      "Only team organisations (shared visibility) have a team view, and only for their active coaches."
    ],
    mind: ["An average hides individuals: a team at 85% can include athletes at 50%. Check Every athlete for who's behind the number."]
  },

  // ---------- progress reports ----------
  reports: {
    title: "Progress reports",
    shows: "A summary of the athlete's training over a set period - a week, a programme block, a training cycle, a whole programme, a year, or any dates you choose.",
    read: [
      "Weekly: every Monday-Sunday week. Block: each block of the programme you wrote (for example a volume block). Cycle: each phase of their season or competition plan (for example accumulation, intensification, peak), when they have a season or competition date. Programme: each programme they have run. Yearly: each calendar year. Custom dates: any two dates up to 2 years apart.",
      "Complete: the period has ended. So far: it's still going - the report shows it up to today and fills in as they train.",
      "Every report is set against the one before it of the same kind (the previous week, the previous block...), so you can see what changed."
    ],
    how: ["Compiled from what the athlete logged each time you open it, so a new report is there as soon as a period ends, and it always matches their latest data."],
    mind: ["Block and programme reports count everything the athlete did in those weeks, not only that programme's sessions."]
  },
  report_overview: {
    title: "The headline numbers",
    shows: "The period at a glance, each with the change since the last report of the same kind.",
    read: [
      "Sessions: sessions done (and part done), with how many were planned. Turned up: planned sessions done, as a percentage. Sets and Tonnage: total work. Weekly load: their average week's training load in load points. Reps hit: logged sets that reached the prescribed reps. Readiness: their average daily check-in, out of 15. Pain reports: how many times they reported pain.",
      "Under a number, 'their usual' is the athlete's own normal from the 4 weeks before the period (readiness as the range they usually sit in); 'on track' and 'normal' are the general guide for that number.",
      "▲ and ▼ show the change since the last report. Green and amber mark the direction of the change - for example more load shows amber, fewer pain reports green.",
      "'pts' means percentage points - 90% to 95% is +5 pts."
    ],
    how: ["Each number is described in the matching section of the Analysis page (open 'What this means' there for the full method)."]
  },
  report_strength: {
    title: "Strength",
    shows: "For each lift trained often enough: the estimated one-rep max at the start and end of the period, the best of the period and the set it came from.",
    read: [
      "Change: from the first week's estimate to the last. vs last report: this period's end against the last report's end.",
      "★ marks a main lift. Lifts without a star are accessories, shown for reference.",
      "A 0% change with the same start and end usually means the athlete repeated the same weight and reps."
    ],
    how: ["Same estimate as the Analysis page: the RTS RPE chart for the heaviest rated set, Epley for other sets of 1-10 reps."],
    mind: ["A lift needs a weighted set in at least 2 different weeks to appear."],
    sources: ["epley1985", "tuchscherer2008"]
  },
  report_weeks: {
    title: "Week by week",
    shows: "Each week of the period in one row, with a chart of the weekly training load.",
    read: [
      "Compare the shape with the plan you wrote: the build through a block, the drop in a deload, a taper.",
      "Load ratio above 1.3 marks a big jump on the weeks before it. Monotony above 2 marks a week with no easy days."
    ],
    how: ["Sessions are those done that week; Turned up is against their planned training days; Load is effort × minutes; Load ratio is that week against the 4 before it."],
    sources: ["foster2001", "gabbett2016"]
  },
  report_exercises: {
    title: "Every exercise",
    shows: "Every exercise the athlete logged in the period: how often, how many sets and reps, total weight lifted, their heaviest set and how hard they rated it.",
    read: [
      "Best: their heaviest set (most reps at that weight); for bodyweight work their most reps in a set; for timed or distance work the total minutes or metres.",
      "% of max: the average weight they lifted as a % of their max, where you prescribed a % of max.",
      "Avg effort: their average rating of the exercise's hardest set in the scale they used - RPE (7-8 is typical working effort, 9-10 is close to their limit), CR10 (0-10, similar to RPE) or Borg (6-20; 13 is 'somewhat hard', 17 'very hard').",
      "Use it to check the programme was done as written - the right exercises, the right amount."
    ],
    how: ["Every logged set, planned and extra, from sessions done or part done. Repeats of an exercise in one session count as the same exercise."]
  },
  report_effort: {
    title: "How hard it felt",
    shows: "How the athlete rated their exercises across the period, grouped by RPE.",
    read: [
      "RPE ratings reflect reps left in reserve, a validated way of rating effort in strength training (Zourdos 2016; Helms 2016).",
      "RPE: 10 = nothing left, 9 = one more rep possible, 8 = two more, 7 = three more, 6 or less = easy. CR10 reads the same way (10 = maximal). Borg 6-20 (Borg 1982) is converted: 13 'somewhat hard' is about 5, 17 'very hard' about 8, 20 = 10."
    ],
    how: ["Each bar is the share of the athlete's exercise ratings in that band, whichever scale they rated in (RPE and CR10 as they are, Borg rescaled to 0-10). The athlete rates the hardest set of each exercise."],
    sources: ["zourdos2016", "helms2016", "borg1982"]
  },
  report_patterns: {
    title: "Sets by movement",
    shows: "Total sets for each movement pattern - squat, hinge, horizontal and vertical push and pull, and so on.",
    read: [
      "Total sets for each pattern, side by side."
    ],
    how: ["Each logged set counts towards its exercise's movement pattern from the exercise library."]
  },
  report_bodyweight: {
    title: "Bodyweight",
    shows: "The bodyweights you recorded for the athlete during the period, and the last one before it as a starting point.",
    read: ["Most useful for weight-class athletes and for reading strength changes - a stronger lift at a heavier bodyweight is a different story from the same lift at a lighter one."],
    how: ["Taken from the strength profile you keep for the athlete. Only weights you recorded appear."]
  },
  report_sessions: {
    title: "Every session",
    shows: "Each session the athlete trained in the period: when, which session, how long, how hard and anything that went wrong.",
    read: [
      "Effort is the average of their exercise ratings for that session (0-10). Load is effort × minutes.",
      "Notes show sessions with pain reported or exercises skipped - open the session in Review for the detail."
    ],
    how: ["Sessions done or part done, by the day they started."]
  },
  report_plan: {
    title: "Doing the plan",
    shows: "How closely the athlete followed the programme in this period.",
    read: [
      "Sets logged and reps hit: as in the Analysis page - 85-90% or more is normal.",
      "Average effort: their average session rating out of 10. Highest load ratio: the period's biggest jump against their normal.",
      "Lines like 'Bench press at 90 kg: RPE 8 → 9' (or CR10 / Borg) mean the same weight was rated harder later in the period.",
      "Weight against the plan and effort against your RPE, Borg or CR10 targets are explained under Doing the plan on the Analysis page."
    ],
    how: ["Working sets of sessions done or part done in the period."]
  },
  report_wellbeing: {
    title: "Readiness, wellbeing and pain",
    shows: "How the athlete felt across the period, and any pain they reported.",
    read: [
      "Readiness is out of 15 (sleep, soreness and stress before sessions). Weeks well below their normal are weeks clearly worse than their own usual.",
      "Weekly check-ins are out of 5. Pain lists each area with how many reports in how many weeks."
    ],
    how: ["As in the Analysis page: readiness compared with the athlete's own previous 28 days; pain as reported in sessions."],
    mind: ["Pain reports are the athlete's own words, not a diagnosis."]
  },
  report_send: {
    title: "What the athlete gets",
    shows: "Their own copy of the report, with your message: the sessions they did week by week, their best on each exercise (weight × reps, bodyweight reps, minutes or metres), their total volume and how they felt.",
    read: ["They find it in History under 'Reports from your coach', can print it, and get a message from you saying it's there."],
    how: ["It is a copy of the report as it stands when you send it - later training doesn't change what they were sent."],
    mind: ["It never shows estimated maxes, percentages of max, load ratios or your flags. Those are your coaching tools, and athletes are shown only the weights and reps they actually lifted."]
  }
};

// "What this means" - folded away, one per part.
export function Explain({ id }: { id: keyof typeof GUIDE | string }) {
  const entry = GUIDE[id];
  if (!entry) return null;
  return (
    <details className="analysis-explain" data-testid={`explain-${id}`}>
      <summary>What this means</summary>
      <div className="analysis-explain-body">
        <p>{entry.shows}</p>
        <p className="eyebrow">How to read it</p>
        <ul>{entry.read.map((line) => <li key={line}>{line}</li>)}</ul>
        <p className="eyebrow">How it's worked out</p>
        <ul>{entry.how.map((line) => <li key={line}>{line}</li>)}</ul>
        {entry.mind?.length ? (
          <>
            <p className="eyebrow">Keep in mind</p>
            <ul>{entry.mind.map((line) => <li key={line}>{line}</li>)}</ul>
          </>
        ) : null}
        {entry.sources?.length ? (
          <>
            <p className="eyebrow">Sources</p>
            <ol className="analysis-sources">
              {entry.sources.map((id) => {
                const source: { cite: string; url?: string } = SOURCES[id];
                return <li key={id}>{source.cite}{source.url ? <> <a href={source.url} target="_blank" rel="noreferrer">Link</a></> : null}</li>;
              })}
            </ol>
          </>
        ) : null}
      </div>
    </details>
  );
}
