import React from "react";

// Plain-English explanations for every part of the coach's Analysis page and
// progress reports: what it shows, how to read it, how it's worked out and
// what to keep in mind. One place, so the page and the reports say the same
// thing about the same number. Shown folded under "What this means".

export type GuideEntry = Readonly<{
  title: string;
  shows: string;
  read: readonly string[];
  how: readonly string[];
  mind?: readonly string[];
}>;

export const GUIDE: Readonly<Record<string, GuideEntry>> = {
  roster: {
    title: "Who needs a look",
    shows: "Every athlete you coach over the last 8 weeks, with the ones that need your attention first.",
    read: [
      "Needs a look (red): at least one serious flag - for example recurring pain, a main lift dropping 5% or more, readiness far below their normal, or fewer than 7 in 10 planned sessions done. Worth a conversation this week.",
      "Keep an eye on (amber): something drifting - load rising quickly, a lift stalling, effort creeping up, a dip in wellbeing. No action needed yet; check again next week.",
      "On track (green): nothing is flagged. The athlete is training as planned and their numbers are steady or improving.",
      "Sessions: planned sessions done in their latest complete week. Load: this week's training load against their own last 4 weeks (1.0 = the same; 0.8-1.3 is normal). Readiness: Normal, or Low when their pre-session check-ins are well below their own usual. Main lifts: ↑ rising, · steady, → plateau (no new best for 6+ weeks), ↓ falling. Load and Readiness turn amber or red when they are outside the athlete's normal."
    ],
    how: [
      "Each athlete is scored from their flags: a 'needs a look' flag counts 3, a 'keep an eye on' flag counts 1. The list is sorted by that score, highest first.",
      "Everything is worked out from what the athlete logged - sets, reps, weights, effort ratings, readiness check-ins, weekly check-ins and pain reports. Nothing is entered by hand."
    ],
    mind: [
      "An athlete who logs little will look 'on track' because there is little to flag. Check the Sessions column alongside the status.",
      "The flags point you at something to ask about; they are not a judgement on the athlete."
    ]
  },
  summary: {
    title: "What stands out",
    shows: "The most important things in this athlete's data, most urgent first, in one sentence each.",
    read: [
      "The top 5 show first - the most serious first (pain, then strength, readiness, load, turning up, doing the plan). 'Show all' lists the rest.",
      "Each comes with a suggested next step. It's a suggestion - you know the athlete and decide.",
      "Related signals are joined into one line - for example a big week followed by a drop, or a lift that's stalling while it also feels harder.",
      "Red - needs a look: act on it or talk to the athlete soon.",
      "Amber - keep an eye on: a trend worth watching; it may sort itself out.",
      "Green - going well: progress worth telling the athlete about.",
      "Each section below starts with its own headline from this list, then shows the chart and the numbers behind it."
    ],
    how: ["Each section runs its own checks (described in that section's 'What this means'). Every check that fires adds one line here, sorted red, then amber, then green."],
    mind: ["'This week' is never complete until Sunday, so load and execution flags use the last complete week. Readiness uses the latest check-ins, including this week's."]
  },
  strength: {
    title: "Strength",
    shows: "How strong the athlete is on each of their main lifts, week by week, as an estimated one-rep max worked out from the sets they logged - no max testing needed.",
    read: [
      "A rising line means they are getting stronger. Most athletes should see a slow rise across a training block, with small dips in heavy or deload weeks.",
      "Real change only: every lift wobbles week to week (a good day, a bad night's sleep). Each lift's own normal variation is measured, and Rising or Falling needs a change bigger than 1.5× that wobble (never under 2%). The lift list shows the wobble as '±x% is normal week-to-week variation'.",
      "× bodyweight is the estimated max divided by their latest bodyweight - the number weight-class and team-sport coaches compare (e.g. a 1.8× bodyweight squat). The tested max is the latest max in their strength profile, next to the estimate: a big gap means it's time to retest or update it.",
      "Rising: up by more than the smallest worthwhile change on their best from at least 4 weeks earlier. Steady: within that. Plateau: no new best for 6 weeks or more while still training the lift - time to change something (rep range, exercise, volume). Falling: their last 2 weeks are 5% or more below their peak, or down 5% or more in 4 weeks - check fatigue, sleep, pain or life stress before pushing on.",
      "Main lifts are the ones you marked as the primary lift in a session. Accessories are listed in the numbers for reference but are never flagged - an accessory kept at one weight on purpose isn't a plateau."
    ],
    how: [
      "From every logged set of 1-10 reps with a weight. If the athlete rated the exercise with an RPE between 6 and 10, the heaviest set uses the RTS (Tuchscherer) RPE chart: weight ÷ the chart's percentage for those reps at that RPE. Those weeks are marked ʳ in the table. Every other set uses Epley: weight × (1 + reps ÷ 30).",
      "Each week shows the single best estimate that week. Hover a point or table cell to see the set it came from."
    ],
    mind: [
      "An estimate, not a tested max. It is most accurate from sets of 1-5 reps and honest RPE ratings; sets of 8-10 reps tend to over- or under-estimate.",
      "Only an RPE rating feeds the RTS chart (it is built on reps in reserve). Borg and CR10 ratings still count for effort and load, but those sets use Epley.",
      "Bodyweight exercises (pull-ups, dips, push-ups) have no estimated max from unweighted sets - their own chart shows the best set in reps each week instead. A weighted set (for example a pull-up with 20 kg) counts the added weight only."
    ]
  },
  execution: {
    title: "Doing the plan",
    shows: "Whether the athlete does the sessions as you wrote them: the sets, the reps, the weights - and whether the same weight is starting to feel harder.",
    read: [
      "Reps hit: of the sets they logged, how many reached at least the prescribed reps (the bottom of a rep range). 90% or more is normal. A drop usually means the weights are too heavy, or the athlete is tired.",
      "Sets logged: of the sets you prescribed, how many they logged. Below about 85% often means sessions are too long or they are skipping the end of the session.",
      "Load vs plan (in the numbers): their weight against the weight you prescribed - a fixed weight, a weight range, or a % of max made a weight. Anywhere inside a range is on plan (0); above it is measured from the top, below it from the bottom. + means heavier than planned.",
      "Effort against the target you set (in the numbers): where you prescribed by RPE, Borg or CR10, their rating of that exercise against your target, in the same scale. Rated 1 RPE (or 1.4 Borg) or more above target over several sessions means the work is harder than you meant - lighten it. 1.5 or more below means there is room to add weight.",
      "Timed and distance work (planks, carries, sprints, rows, sled pushes) is done by completing it rather than set by set: completing it counts all its prescribed sets as done, skipping it counts them as missed.",
      "Feels harder at the same weight: the same exercise at about the same top weight, rated in the first half of the period and again in the second. A rise of 1 RPE or more is an early sign of accumulated fatigue - often worth a lighter week.",
      "Most often short of the plan: the exercises where they most often fall short on sets or reps - a candidate to adjust."
    ],
    how: [
      "Only working sets (not warm-ups or cool-downs) of sessions marked done or part done.",
      "Effort comparison: top weights within 2.5% of each other count as 'the same weight', rated in the same scale (RPE, Borg or CR10).",
      "Reps hit only applies where reps were prescribed; bodyweight sets are checked on reps like any other."
    ],
    mind: [
      "If the athlete doesn't rate exercises, the effort comparisons can't be made. Ask them to rate the hardest set of each exercise.",
      "Where the athlete chooses their own weights (no prescribed weight), there is no load to compare - reps and effort still are."
    ]
  },
  testing: {
    title: "Testing",
    shows: "The tests you record for the athlete - jumps, sprints, agility, conditioning, grip - with their latest result, the change since last time, their best, and whether the change is real.",
    read: [
      "Real improvement / Real decline: the change since the previous result is bigger than the test's smallest worthwhile change. Within normal variation: it isn't - the athlete may have improved, or it may be a good or bad day; retest before drawing conclusions.",
      "Smallest worthwhile changes used: CMJ and squat jump 1.5 cm, broad jump 5 cm, 10 m sprint 0.03 s, 20 m 0.04 s, 40 m 0.06 s, 505 0.05 s, Yo-Yo IR1 40 m, Bronco 5 s, 2 km row 3 s, grip 2 kg, pull-ups 1 rep. Hover a verdict to see it.",
      "Test in the same conditions each time - same warm-up, surface, time of day, and not the day after a hard session - or the change measures the conditions, not the athlete."
    ],
    how: [
      "Record a result with the form below the table; remove a wrong one with ×. Results are kept on the athlete's record, with who recorded them.",
      "Lower is better for times (sprints, 505, Bronco, 2 km row); higher for the rest."
    ],
    mind: ["The smallest worthwhile changes are typical values for trained athletes. With a squad of 10 or more, the team view works out your own squad's."]
  },
  intensity: {
    title: "Intensity (% of max)",
    shows: "How heavy the athlete's lifting was relative to their max, where your programme sets weights as a % of max: the share of sets in each zone, and the average % they lifted each week.",
    read: [
      "Under 60%: technique, speed and warm-up work. 60-70%: volume and hypertrophy. 70-80%: the core of most strength work. 80-90%: heavy strength. 90% and over: near-maximal - singles, doubles and peaking.",
      "A volume block should sit mostly in 60-80%, a peaking block shift towards 80-90%+. Lots of 90%+ sets for weeks on end is hard to recover from.",
      "If the average % is well above what you prescribed, the athlete is going heavier than planned - check Doing the plan."
    ],
    how: [
      "Each logged set's weight ÷ the max your % was worked out from (the max recorded in the athlete's strength profile when the session was made). Zones count sets.",
      "Only sets prescribed as a % of max are included - fixed weights, RPE targets and bodyweight work have no max to compare against."
    ],
    mind: ["The % is against the recorded max. If the athlete has got stronger since it was recorded, the real % is lower - update their max."]
  },
  load: {
    title: "Training load",
    shows: "How much total work the athlete did each week - combining how hard it felt with how long it took - and whether this week is a big jump from what they're used to.",
    read: [
      "Weekly load: higher bars are harder weeks, split into gym and sport (team practice, matches, conditioning the athlete logs). For a team-sport athlete the sport bar is usually the bigger one - a 'quiet' gym week can still be a heavy week.",
      "Letters on the charts mark the weeks with a Competition (C), Match (M), Deload (D), Peak block (P) or Season start/end (S) - hover for the detail. Read the trend against them: load should drop in a deload and before a competition.",
      "Load ratio (acute:chronic): this week against their average of the 4 weeks before. 1.0 means the same as usual. 0.8-1.3 (the shaded band) is normal week-to-week variation. Above 1.3 is a big jump; above 1.5 is a spike - common before soreness, niggles and missed sessions. Below 0.8 is a drop - expected in a deload or a taper, worth asking about otherwise.",
      "Monotony (in the numbers): how similar the days of the week are. Above 2 means every day is about as hard as every other, with no easy days - a risk for staleness.",
      "Strain (in the numbers): weekly load × monotony. A high load and high monotony together is the combination to avoid."
    ],
    how: [
      "Session load (Foster's session-RPE method) = session effort × minutes, in load points (the research calls them arbitrary units, AU). Measured: the athlete rates the whole session (0-10) and says how long it took when they finish it. Estimated, if they don't: the average of their exercise ratings × the minutes from starting the session to the last thing they logged (capped at 4 hours). The Load section says how many sessions were measured.",
      "Practice, matches and conditioning the athlete logs add their own effort × minutes.",
      "Load ratio = this week's load ÷ the mean of the 4 previous weeks' loads. Monotony = the week's average daily load ÷ the standard deviation of its 7 daily loads (rest days count as 0). Strain = weekly load × monotony."
    ],
    mind: [
      "Sessions with no effort ratings add no load, and practice or matches the athlete doesn't log are missing - both make a week look lighter than it was.",
      "The load ratio is a guide, not a prediction: research disagrees on how well it predicts injury. Use it with what the athlete tells you."
    ]
  },
  adherence: {
    title: "Turning up",
    shows: "How many of their planned sessions the athlete actually did each week, which days they train on, and which exercises they skip.",
    read: [
      "90-100% means they are training as planned. 70-90% is worth watching. Under 70% means the plan and their life don't fit - ask what is getting in the way before adding more.",
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
      "Low: a week clearly below their own usual. Well below (needs a look): a big drop - consider a lighter session and a conversation.",
      "Weekly check-ins: a fall of 1.5 points or more in energy, motivation or sleep is flagged.",
      "Optional extras the athlete can add: tiredness and mood (1-5), resting heart rate and HRV from a watch or strap. HRV falling and resting heart rate rising together, against their own normal, is a classic sign of fatigue or illness coming on."
    ],
    how: [
      "Each check-in is compared with the same athlete's previous 28 days as a z-score: how many 'normal swings' away from their average it is. Low = a week averaging -1 or lower; well below = -1.5 or lower. It needs 5 earlier check-ins before it can tell.",
      "Weekly check-ins: the last 2 weeks against their earlier weeks in the period.",
      "HRV: the natural log of the reading (HRV is skewed) against their previous 28 days as a z-score; a week averaging -1.5 or lower is flagged. Resting heart rate: 5+ bpm above their 28-day average is flagged. Both need 5 earlier readings."
    ],
    mind: ["HRV and resting heart rate only compare well when taken the same way each time - first thing in the morning, same device.", "Readiness is only as good as the check-ins. Encourage honest answers - a low score is useful information, not a failure."]
  },
  velocity: {
    title: "Bar speed",
    shows: "How fast the bar moves, for athletes who log it from a velocity (VBT) device: speed at the same weight over time and how much speed they lose across their sets.",
    read: [
      "Faster at the same weight usually means stronger; slower is often the first sign of fatigue, before the estimated max moves.",
      "Speed lost across sets: 20-30% is normal for hard work; a lot more means a very fatiguing session."
    ],
    how: ["Athletes switch on \"Log bar speed\" on their set logger and type the mean velocity their device shows for each set."],
    mind: ["Different devices read differently - compare an athlete with themselves on the same device, not with others."]
  },
  injuries: {
    title: "Injuries",
    shows: "The athlete's injury log: each injury, how it happened, whether it stopped them training, days lost and how they're coming back.",
    read: [
      "Days lost: days out of training, from the injury to their return. Days on modified training are shown separately.",
      "Severity uses the bands sports medicine uses: minimal 1-3 days lost, mild 4-7, moderate 8-28, severe over 28.",
      "A re-injury - the same place, same side, within 2 months of coming back - is flagged: it usually means the return was too quick.",
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
    ]
  },
  gps: {
    title: "Running load (GPS / HR)",
    shows: "What the athlete did on the pitch or court, from your GPS or heart-rate system's exports: distance, high-speed running (HSR), sprint distance, player load and heart rate, week by week.",
    read: [
      "High-speed running is the number to watch most: big week-to-week jumps in HSR are closely linked to hamstring and calf strains.",
      "HSR vs usual: this week against the average of the 4 weeks before. 0.8-1.3× is a normal range; above 1.5× is flagged.",
      "Low HSR for weeks can matter too - an athlete who never runs fast in training isn't ready to in a match."
    ],
    how: [
      "Import a CSV from Catapult, STATSports, Polar, Garmin or similar under Squad entry > Import GPS / HR. Match the columns once (they are guessed for you), check the preview, then import.",
      "Rows are matched to athletes by email first, then by name. The same session imported twice is only kept once.",
      "Weekly totals are summed; average heart rate is averaged."
    ],
    mind: ["Speed thresholds for 'high speed' and 'sprint' differ between systems and settings - keep yours the same across the season so weeks compare.", "This is kept separate from effort-based load (minutes × effort), so a session isn't counted twice."]
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
      "One report can be a bad day. The same area in 2 or more different weeks is flagged - talk to the athlete, adjust the exercises involved, and refer them on if it continues.",
      "'First reported in a week at 2.5× normal load' means the pain started in a week where training load jumped well above their usual - a pattern worth avoiding next time."
    ],
    how: ["Every pain report logged during a session, grouped by the area the athlete chose, with the exercise they reported it on."],
    mind: ["This is what the athlete reported. It is not a diagnosis - Kolosseum never diagnoses. Pain that persists or worsens needs a medical professional."]
  },
  volume: {
    title: "Volume",
    shows: "How much work the athlete did: sets logged each week and total weight lifted (tonnage), and hard sets per muscle group against the usual weekly range for their level.",
    read: [
      "Volume should follow your plan: higher in volume blocks, lower in peaking blocks and deloads.",
      "A sudden fall in sets with no planned deload often goes with missed sessions or skipped exercises - check Turning up.",
      "Per muscle group: under the range is less than usually builds muscle there - fine when size there isn't the aim (a runner's chest, a fighter making weight). Over is more than most athletes at that level recover from - fine for a planned overreach with a lighter week after it, a question if it goes on."
    ],
    how: [
      "Every logged set, planned and extra. Tonnage = reps × weight, added up across every set.",
      "Sets per muscle group: each logged set of strength work counts in full for every group the exercise targets and as half a set for each group only its secondary muscles reach - the same count as the programme builder. Jumps, sprints, throws, Olympic lifts, carries and conditioning don't count. Planned is the sets prescribed in that week's sessions.",
      "Ranges (sets a week) by level, from the research on weekly sets per muscle: Beginner chest 6-16, back 6-18, quads 6-16, hamstrings 4-12; Amateur chest 8-22, back 10-24, quads 8-22, hamstrings 6-20; Pro chest 10-26, back 12-28, quads 10-26, hamstrings 8-24. Glutes and lower back run higher (they get a full set from many compound lifts), and so do shoulders (front, side and rear delts together); smaller groups have a maximum only. A sport's focus groups (a grip athlete's forearms, a weightlifter's legs) have no maximum.",
      "Bodyweight reps: the reps of sets logged with no weight added (they add nothing to tonnage). Timed and distance work: sets × the prescribed time or distance, counted once the athlete completes it."
    ],
    mind: ["Tonnage favours heavy lower-body lifts, so compare weeks with each other rather than exercises with each other.", "Timed and distance work is counted as prescribed: the athlete marks it done rather than logging their actual time or distance."]
  },

  team: {
    title: "Team analysis",
    shows: "Every athlete in the team over the last 8 weeks, summed up as a group - so you can see whether something is happening to one athlete or to the whole squad.",
    read: [
      "Group findings count athletes: '3 athletes of 7 had a big jump in training load' means the group, not one person. When several athletes show the same thing at once, look at what they have in common - the plan, the fixture list, exams, travel or an illness going round - before treating them one by one.",
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
      "▲ and ▼ show the change since the last report. Green is a change in the right direction, amber in the wrong one - for example more load is amber because it adds fatigue, fewer pain reports is green.",
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
      "A 0% change with the same start and end usually means the athlete repeated the same weight and reps - expected for an accessory, worth progressing for a main lift."
    ],
    how: ["Same estimate as the Analysis page: the RTS RPE chart for the heaviest rated set, Epley for other sets of 1-10 reps."],
    mind: ["A lift needs a weighted set in at least 2 different weeks to appear."]
  },
  report_weeks: {
    title: "Week by week",
    shows: "Each week of the period in one row, with a chart of the weekly training load.",
    read: [
      "Look for the shape you planned: rising load through a block, a drop in a deload, a taper before a competition.",
      "Load ratio above 1.3 marks a big jump on the weeks before it. Monotony above 2 marks a week with no easy days."
    ],
    how: ["Sessions are those done that week; Turned up is against their planned training days; Load is effort × minutes; Load ratio is that week against the 4 before it."]
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
      "Most strength work should sit around RPE 7-8. A lot of 9-10 ratings means they are training close to their limit often - fine in a peaking block, a fatigue risk the rest of the time. A lot of 6 or less means the work may be too easy to drive progress.",
      "RPE: 10 = nothing left, 9 = one more rep possible, 8 = two more, 7 = three more, 6 or less = easy. CR10 reads the same way (10 = maximal). Borg 6-20 is converted: 13 'somewhat hard' is about 5, 17 'very hard' about 8, 20 = 10."
    ],
    how: ["Each bar is the share of the athlete's exercise ratings in that band, whichever scale they rated in (RPE and CR10 as they are, Borg rescaled to 0-10). The athlete rates the hardest set of each exercise."]
  },
  report_patterns: {
    title: "Sets by movement",
    shows: "Total sets for each movement pattern - squat, hinge, horizontal and vertical push and pull, and so on.",
    read: [
      "A quick balance check: for example pushing far more than pulling, or no hinge work, is worth correcting.",
      "Compare it with what the athlete's sport needs."
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
      "Lines like 'Bench press at 90 kg: RPE 8 → 9' (or CR10 / Borg) mean the same weight felt harder later in the period - a sign of fatigue.",
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
      </div>
    </details>
  );
}
