# Kolosseum programmes v1 — design notes (draft for coach review)

The programmes themselves are defined in
`product/programmes/kolosseum_programmes_v1.mjs` (sets, reps, loads and weekly
% waves, exactly as written below).

## How to publish these

1. Make the Kolosseum account a catalogue author: add its email to the
   server setting `KOLOSSEUM_PROGRAMME_AUTHORS` (comma-separated) and restart.
2. Create the programmes as **drafts** in that account:

   ```
   KOLOSSEUM_BASE_URL=https://<your server> KOLOSSEUM_AUTHOR_EMAIL=<email> KOLOSSEUM_AUTHOR_PASSWORD=<password> node scripts/seed_kolosseum_programmes.mjs
   ```

   Running it again skips programmes the account already has.
3. In the builder, open each programme, review and edit it, then **Save
   complete template** and **Activate programme**.
4. On the programme page, **Publish to coaches**: confirm the title, summary,
   levels, sports and days a week (suggested values for each are in the file
   above), then publish.
5. Once both halves of a pair are published, set **When athletes finish it,
   offer next** on each (the seed script prints the pairs, below).

Coaches see a programme only once it is published. They copy it into their
own library, adapt it and assign it to their athletes. **Athletes without a
coach don't see these programmes**: they build their own week in "My
training" (athlete_training_week_service.ts).

### What comes next

This applies only to an athlete still running a programme they started
before Kolosseum programmes became coach-only. When they finish, they're
offered the programme it leads to, or they can run it again:

| Finished | Offered next |
|---|---|
| Beginner full-body | Intermediate upper/lower. It's for amateurs, so the athlete is told to move their level up first |
| Powerlifting meet prep | Intermediate upper/lower, to rebuild after the meet |
| Off-season build (team, tennis, cricket, athletics power) | That sport's in-season programme |
| In-season programme (team, tennis, cricket, athletics) | That sport's off-season build |
| Run and ride, or swim, row and paddle strength | Endurance race-season maintenance |
| Combat strength and power | Fight camp strength |
| Fight camp strength | Combat strength and power, between camps |

Intermediate upper/lower and endurance race-season maintenance offer nothing
next. The athlete runs them again or chooses.

Fourteen programme families, written as starting points for coaches. Each is
an ordinary programme in the builder, so it can be edited there before it's
published. Nothing reaches coaches until it's reviewed, activated and
listed.

## How weights work in every programme

Main lifts are written as **% of 1RM** with a fixed rep target. The athlete's
own setting decides what they see:

- **Build from what you lift** (the beginner default): the % is ignored. The
  first session gives a technique weight; after that, every rep made adds
  2.5 kg (lower body) or 1.25 kg (upper body), missed reps repeat, and two
  misses in a row take 10% off.
- **% of max**: the % becomes a weight from their max (or their estimated max
  from logged sets).
- **RPE**: the % becomes an equivalent effort target.

Accessories are written as **RPE** (they don't have maxes worth testing). A
beginner building from what they lift gets the same build-up on those too, not
an RPE target; a bodyweight exercise written at an RPE keeps it for everyone
else (pull-ups at RPE 8).
Bodyweight work is written as bodyweight. Jumps, sprints and throws are
written by reps or distance, never loaded by %.

So one programme serves a true beginner (progression) and an experienced
lifter (%), without separate versions.

**Back after a break:** an athlete returning after 10 or more days away, or
in the first week after a head injury, gets a lighter re-entry week. That
week's sessions are the programme's next ones, each with one set fewer and
lighter loads:
- **Loads:** 10% lighter, rounded down to a plate (20% after 28 or more days,
  or a head injury).
- **% of 1RM:** 10 points lower (20 after a long break).
- **RPE targets:** 1 easier (2 after a long break), never below RPE 5.

The programme then carries on where it left off. The athlete is told why.

---

## Timed to the competition

A programme that ends in a taper week (powerlifting, weightlifting,
strongman and street lifting meet preps, the HYROX race build, fight camp)
is timed to the competition, not to how many sessions the athlete has done.
The date is the event the coach linked the programme to, else the
competition date the athlete declared in their training plan.

- **Behind** (sessions missed, or assigned with fewer weeks left than the
  programme has): the next session skips ahead so the taper lands in
  competition week. The missed build weeks are dropped; the peak and taper
  never are.
- **Early** (reached the taper with the competition still more than the
  taper's length away): the last build week repeats until the taper fits.
- Off-season, in-season and maintenance programmes are never re-timed.

## Re-setting maxes

Percentages come from the athlete's entered max, raised automatically when
sets they've logged since show they're stronger (a rep-out set, a heavy
triple). A max is never lowered by one bad session: missed reps and high
RPEs are handled by autoregulation instead.

## 1. Beginner full-body (beginner · any sport · 3 days a week · 12 weeks)

**Who it's for:** anyone new to structured lifting, including athletes from
any sport. It's the general programme a sport without its own programme falls
back to.

**Why this structure:** novices recover from and adapt to the same stimulus
quickly, so the most effective approach is frequent practice of a small set of
compound lifts with a small load increase each session (linear progression).
Three full-body days give each pattern 1–2 exposures a week, enough to learn
technique and keep adding weight, with recovery days between sessions.

**Sessions:** A and B alternate (week 1: A B A; week 2: B A B; …).

| Day A | Sets × reps | Load |
|---|---|---|
| Back squat | 3 × 5 | % 1RM |
| Bench press | 3 × 5 | % 1RM |
| Barbell row | 3 × 8 | % 1RM |
| Romanian deadlift | 2 × 8 | % 1RM |
| Front plank | 3 × 30 s | bodyweight |

| Day B | Sets × reps | Load |
|---|---|---|
| Back squat | 3 × 5 | % 1RM |
| Overhead press | 3 × 5 | % 1RM |
| Deadlift | 1 × 5 | % 1RM |
| Lat pulldown | 3 × 10 | RPE 7 |
| Dead bug | 3 × 8 each side | bodyweight |

**Progression for % users:** 65% in week 1, +2.5% a week, with lighter
weeks (−10%) in weeks 4 and 8, reaching about 82.5% by week 12. For
progression users the weights come from what they lift (above).

**Rest:** 2–3 min on main lifts, 90 s on accessories.

**Equipment:** barbell, rack and bench. An athlete without them gets their
equipment's substitutes automatically (e.g. goblet squat, dumbbell press).

**After week 12:** move to Intermediate upper/lower, or repeat.

---

## 2. Intermediate upper/lower (amateur, pro · any sport · 4 days a week · 8 weeks)

**Who it's for:** lifters past the novice stage, where session-to-session
gains have stalled and progress now comes week to week.

**Why this structure:** an upper/lower split doubles the weekly frequency
per muscle group while keeping each session manageable. Each half of the body
gets a heavier strength day (5s) and a lighter volume day (8–12s): the classic
heavy/light pairing for intermediates. Main lifts follow a 4-week wave (3
building weeks, then a deload), and the second wave starts 2.5% higher. The
heavy 5s top out at 80%: four sets of 5 at 82.5% is about 95% of a 5-rep max,
where reps get missed.

**Re-setting the max:** in weeks 3 and 7 the last set of each main lift
(bench, squat, deadlift) is a rep-out - as many good reps as possible,
stopping one short of failure. The reps update the athlete's estimated max,
so the next wave (and the next run of the programme) starts from where they
are now, not from an old max.

| Upper 1 (strength) | Sets × reps | Load |
|---|---|---|
| Bench press | 4 × 5 | 72.5 / 75 / 77.5 / 62.5% (rep-out in week 3) |
| Barbell row | 4 × 6 | 70 / 72.5 / 75 / 60% |
| Overhead press | 3 × 6 | 70 / 72.5 / 75 / 60% |
| Pull-up | 3 × 6–8 | RPE 8 |
| Cable triceps pressdown | 3 × 12 | RPE 8 |

| Lower 1 (strength) | Sets × reps | Load |
|---|---|---|
| Back squat | 4 × 5 | 72.5 / 75 / 77.5 / 62.5% (rep-out in week 3) |
| Romanian deadlift | 3 × 8 | 65 / 67.5 / 70 / 60% |
| Bulgarian split squat | 3 × 8 each leg | RPE 8 |
| Lying leg curl | 3 × 10 | RPE 8 |
| Side plank | 3 × 30 s each side | bodyweight |

| Upper 2 (volume) | Sets × reps | Load |
|---|---|---|
| Incline dumbbell press | 4 × 10 | RPE 8 |
| Seated cable row | 4 × 10 | RPE 8 |
| Dumbbell overhead press | 3 × 10 | RPE 8 |
| Dumbbell lateral raise | 3 × 15 | RPE 8 |
| Face pull | 3 × 15 | RPE 7 |

| Lower 2 (volume) | Sets × reps | Load |
|---|---|---|
| Deadlift | 3 × 5 | 72.5 / 75 / 77.5 / 65% |
| Front squat | 3 × 8 | 62.5 / 65 / 67.5 / 55% |
| Walking lunge | 3 × 10 each leg | RPE 8 |
| Barbell hip thrust | 3 × 10 | RPE 8 |
| Standing calf raise | 3 × 15 | RPE 8 |

**Weeks 5–8:** the same, main-lift percentages +2.5%.

---

## 3. Powerlifting meet prep (amateur, pro · powerlifting · 4 days a week · 12 weeks)

**Who it's for:** lifters preparing for a full-power meet.

**Why this structure:** block periodisation. Each block focuses on one
quality and hands on to the next:
accumulation (volume, positions, work capacity) → intensification (heavier
triples and doubles) → realisation (heavy singles, then a taper so fatigue
clears before the meet). Squat, bench and deadlift each get a primary day and
a variation day. Bench runs 2–3 times a week because it tolerates and needs
more frequency.

The intensity is set by the RPE chart, not by feel: accumulation sets of 5
at 72.5–77.5% sit at RPE 5.5–7.5, and intensification triples at RPE 7–8.5
- the range Calgary Barbell- and Sheiko-style programmes train in. Squat runs
twice a week (the main day and a paused squat on deadlift day), bench three
times, deadlift once plus Romanian deadlifts.

| Block | Weeks | Squat / Bench / Deadlift main sets |
|---|---|---|
| Accumulation | 1–4 | 4–5 × 5–6 at 72.5 → 77.5%, RPE 5.5 → 7.5 (week 4: 65%) |
| Intensification | 5–8 | 4–5 × 3 at 82.5 → 87.5%, RPE 6.5 → 8.5 (week 8: 72.5%) |
| Realisation | 9–11 | 4 × 2 at 87.5%, 3 × 2 at 90%, then a single at 92.5% (week 11), RPE 8–8.5 |
| Taper and meet | 12 | Openers ×1 at about 90% early in the week; then rest |

**Sessions each week:**
- Day 1: back squat (main), paused bench press, barbell row, leg curl
- Day 2: bench press (main), close-grip bench press, pull-up, face pull
- Day 3: deadlift (main), paused back squat (4 sets, 12.5% under the main squat), Romanian deadlift, front plank
- Day 4: bench press (variation: Spoto press or paused bench), overhead press, chest-supported row, triceps

**Accessories:** RPE 7–8, dropping in volume through the blocks.

---

## 4. Team sports (amateur, pro · by family and position)

Ten team sports don't share one set of demands, so they get four families of
programmes, each with an off-season build and in-season maintenance:

| Family | Sports | Off-season | In-season |
|---|---|---|---|
| Collision: forwards and linemen | rugby union, league, sevens; American football | 4 days · 12 weeks | 2 days · 12 weeks (shared) |
| Collision: backs and skill players | the same | 3 days · 12 weeks | 2 days · 12 weeks (shared) |
| Field and ice | football, field hockey, ice hockey | 3 days · 8 weeks | 2 days · 12 weeks |
| Court | netball, basketball, volleyball | 3 days · 8 weeks | 2 days · 12 weeks |

Explosive work comes first in every session, while the athlete is fresh. The
app's match-week setting keeps heavy leg work away from the day before a
match in every in-season programme.

### 4a. Collision off-season: forwards and linemen (4 days a week · 12 weeks)

**Why this structure:** forwards and linemen need mass, maximal strength and
a neck that can take scrums, mauls, tackles and line play. The off-season
runs the classic sequence: a hypertrophy block, a max-strength block, then
strength and power, each ending with a lighter week.

| Main lifts (squat, bench, trap bar deadlift) | Weeks 1–4 | Weeks 5–8 | Weeks 9–12 |
|---|---|---|---|
| Sets × reps | 4 × 8 | 5 × 5 | 4 × 3 |
| Load | 67.5 → 72.5%, week 4 60% | 77.5 → 82.5%, week 8 70% | 82.5 → 87.5%, week 12 75% |

| Day | Session |
|---|---|
| Lower A | Box jump; **back squat**; Romanian deadlift; Bulgarian split squat; Nordic curl; neck flexion and extension holds |
| Upper A | Medicine ball chest pass; **bench press**; pull-up (weighted once 8 are easy); barbell row; dumbbell overhead press; neck side holds |
| Lower B | Broad jump to stick; **trap bar deadlift**; front squat; heavy sled push; Copenhagen plank; neck flexion and extension holds |
| Upper B | Incline bench press; chin-up; landmine press; chest-supported row; farmer's carry; face pull |

Accessory reps follow the block: 10, then 8, then 6.

### 4b. Collision off-season: backs and skill players (3 days a week · 12 weeks)

**Why this structure:** backs and skill players win on speed, but they're
tackled too. Each week has an acceleration day and a top-speed day (sprints
first, full recovery), heavy lifting through the same 8s → 5s → 3s blocks,
Nordic curls, Copenhagen planks, and neck strength twice a week.

| Day | Session |
|---|---|
| Acceleration and squat | 20 m accelerations; **back squat**; single-leg RDL; Nordic curl; neck flexion and extension holds |
| Upper strength | Medicine ball chest pass; **bench press**; pull-up; single-arm row; neck side holds; side plank |
| Top speed and power | Flying 20 m sprints; **trap bar deadlift** (5s at most); lateral bound; walking lunge; Copenhagen plank; Pallof press |

### 4c. Collision in-season maintenance (2 days a week · 12 weeks)

Two short, heavy sessions (3 × 3 at 80–85%, every fourth week lighter) with
neck holds in both, Nordic curls and Copenhagen planks every week.

### 4d. Field and ice off-season (3 days a week · 8 weeks)

**Why this structure:** football, field hockey and ice hockey lose most
playing time to hamstring and groin injuries. The Nordic curl and the
Copenhagen adductor plank are the two exercises with the strongest evidence
for preventing them, so both are in every week of the year. Acceleration,
deceleration and lateral bounds come first, for cutting and skating.

| Main lifts (squat, trap bar deadlift) | Weeks 1–4 | Weeks 5–8 |
|---|---|---|
| Sets × reps | 3–4 × 6 | 4 × 4 |
| Load | 70 → 75%, week 4 65% | 80 → 85%, week 8 72.5% |

| Day | Session |
|---|---|
| Acceleration and squat | 10 m accelerations; **back squat**; Romanian deadlift; Nordic curl; Copenhagen plank |
| Upper and trunk | Rotational medicine ball throw; pull-up; dumbbell bench press; single-arm row; side plank; Pallof press |
| Change of direction and single leg | Lateral bound; **trap bar deadlift**; 10 m deceleration; Bulgarian split squat; lateral lunge; hip adduction; single-leg calf raise |

### 4e. Field and ice in-season (2 days a week · 12 weeks)

Two short, heavy sessions with Nordic curls and Copenhagen planks every week,
and adductor and trunk work.

### 4f. Court off-season (3 days a week · 8 weeks)

**Why this structure:** netball, basketball and volleyball players jump
hundreds of times a week in practice, so the gym adds only a few maximal
jumps. The extra work goes into landing and deceleration, patellar-tendon
holds (the bottom of a split squat held for 30 s), calves and shins, the
groin, and the hitting and shooting shoulder. Main lifts as 4d.

| Day | Session |
|---|---|
| Jump, land and squat | Countermovement jump; **back squat**; drop to stick; split squat hold; Nordic curl; single-leg calf raise |
| Upper and shoulder | Medicine ball chest pass; landmine press; pull-up; single-arm row; band external rotation; Pallof press |
| Deceleration and single leg | Lateral bound; **trap bar deadlift**; lateral deceleration; Bulgarian split squat; Copenhagen plank; tibialis raise; side plank |

### 4g. Court in-season (2 days a week · 12 weeks)

No extra jumping (games supply it). Heavy, low-rep squats and deadlifts,
patellar-tendon holds, Copenhagen planks and shoulder care every week.

## 5. Endurance strength (amateur, pro · endurance sports)

Three programmes: two off-season builds, split by how each sport moves, and
one to keep strength through the racing season.

**Why heavy and low-rep:** in trained runners, cyclists, rowers and
swimmers, adding heavy strength work (about 4–6 reps at 80–90%, short of
failure) and plyometrics improves economy. Economy means less energy at the
same pace or power. It also improves late-race power and resistance to
injury, without the weight gain endurance athletes worry about.

That only works at low volume. Every session is short, with five or six
exercises, and sits alongside the athlete's own training. The first four
weeks (3 × 8 at 65–70%) teach the lifts and prepare tendons before the heavy
blocks. Every fourth week is lighter.

| Main lifts | Weeks 1–4 | Weeks 5–8 | Weeks 9–12 |
|---|---|---|---|
| Sets × reps | 3 × 8 | 4 × 5 | 4 × 4 |
| Load | 65 → 70% (60% week 4) | 77.5 → 82.5% (70% week 8) | 82.5 → 87.5% (75% week 12) |

### 5a. Run and ride strength (distance running, cycling · 2 days a week · 12 weeks)

| Strength A (squat) | Sets × reps | Load |
|---|---|---|
| Pogo jump | 2–3 × 10 | bodyweight, quick ground contacts |
| Back squat | as above | as above |
| Single-leg RDL | 3 × 6 each leg | RPE 7 |
| Single-leg calf raise | 3 × 8 each leg | RPE 8 (hold a weight when it's easy) |
| Side plank | 2 × 30 s each side | bodyweight |

| Strength B (hinge) | Sets × reps | Load |
|---|---|---|
| Box jump | 2–3 × 3 | bodyweight, step down |
| Trap bar deadlift | as above | as above |
| Bulgarian split squat | 3 × 6 each leg | RPE 8 |
| Inverted row | 3 × 8 | bodyweight |
| Wall tibialis raise | 2 × 15 | bodyweight |
| Pallof press | 2 × 10 each side | RPE 7 |

The calf and Achilles and the shin take most running injuries. Heavy
single-leg calf raises are the most direct way to build their capacity.

Sprinters, jumpers and throwers have their own programmes (section 9).
Both are listed for athletics, so athletes pick the one for their event.

### 5a-ii. Triathlon strength (2 days a week · 12 weeks)

Triathletes train three sports, so their two sessions combine the run-and-ride
lower body (the same heavy squat and trap bar deadlift waves, pogo and box
jumps, calves and shins) with the swimmer's pulling (pull-ups, rows) and
rotator-cuff work every week.

| Strength A (squat and pull) | Strength B (hinge and row) |
|---|---|
| Pogo jump; **back squat**; pull-up 3 × 4–6; single-leg calf raise; band external rotation; side plank | Box jump; **trap bar deadlift**; Bulgarian split squat; seated cable row; side-lying external rotation; tibialis raise |

### 5b. Swim, row and paddle strength (swimming, rowing, kayaking · 2 days a week · 12 weeks)

| Strength A (legs and pull) | Sets × reps | Load |
|---|---|---|
| Squat jump | 2–3 × 3 | bodyweight (starts, turns, the drive) |
| Trap bar deadlift | as above | as above |
| Pull-up | 4 × 4–6 | RPE 8 |
| Landmine press | 3 × 6 | RPE 8 |
| Band external rotation | 2 × 15 | RPE 6 |
| Dead bug | 2 × 8 each side | bodyweight |

| Strength B (squat and row) | Sets × reps | Load |
|---|---|---|
| Overhead medicine ball slam | 3 × 5 | 4 kg, explosive |
| Back squat | as above | as above |
| Seated cable row | 3 × 8 | RPE 8 |
| Cable woodchop | 3 × 8 each side | RPE 7 |
| Side-lying external rotation | 2 × 12 each arm | RPE 7 |
| Side plank | 2 × 30 s each side | bodyweight |

- **Swimmers, rowers and paddlers** pull thousands of strokes a week, so
  rotator-cuff work is in both sessions.
- **Pressing** is the landmine press, an angled press that's easier on the
  shoulder than a full overhead press.
- **Rowing** is leg-driven, so the heavy lifts are the same as 5a.
- **Kayakers** get rotation from the woodchop.

### 5c. Race-season maintenance (all six endurance sports · 1 day a week · 12 weeks)

| Maintenance session | Sets × reps | Load |
|---|---|---|
| Box jump | 3 × 3 | bodyweight |
| Back squat | 3 × 4 | 80 → 85% (75% every 4th week) |
| Single-leg calf raise | 2 × 8 each leg | RPE 8 |
| Pull-up | 3 × 5 | RPE 7 |
| Band external rotation | 2 × 15 | RPE 6 |
| Pallof press | 2 × 10 each side | RPE 7 |

One heavy session a week holds most of the strength built in the off-season.
The rotator-cuff set stays in because race season is when swimmers, rowers and
paddlers carry their highest stroke volume.
The listing tells the athlete to skip it in the five days before a key race.

## 6. Combat sports (amateur, pro · boxing, Muay Thai, MMA, wrestling, judo, BJJ)

Two programmes: one to build between fight camps, and one for the camp itself.

**Why this structure:** fighters compete at a weight. So strength and power
are built with low reps (3–6) and moderate volume, avoiding the high-volume
work that adds size. Every week trains four things:
- **Neck:** to absorb blows, and for grappling (bridging, posture, the
  clinch). Neck work is isometric (band-resisted holds), the safest way to
  load it.
- **Grip:** for gi and no-gi grappling and the clinch.
- **Rotational power:** for punching, kicking and throwing.
- **Trunk stiffness:** trained with carries and anti-rotation work.

Nothing in either programme cuts weight. Making weight is for the athlete and
their coach.

### 6a. Combat strength and power (between camps · 3 days a week · 8 weeks)

| Day 1 (lower strength and neck) | Sets × reps | Load |
|---|---|---|
| Box jump | 4 × 3 | bodyweight |
| Trap bar deadlift | 4 × 4 | 72.5 → 82.5% |
| Bulgarian split squat | 3 × 6 each leg | RPE 8 |
| Nordic curl | 3 × 4 | bodyweight |
| Neck flexion hold | 3 × 20 s | band, RPE 6 |
| Neck extension hold | 3 × 20 s | band, RPE 6 |

| Day 2 (upper strength and grip) | Sets × reps | Load |
|---|---|---|
| Medicine ball chest pass | 4 × 5 | 4 kg, explosive |
| Bench press | 4 × 5 | 72.5 → 82.5% |
| Pull-up | 4 × 5–8 | RPE 8 |
| Single-arm dumbbell row | 3 × 8 | RPE 8 |
| Dumbbell static hold (grip) | 3 × 30 s | RPE 8 |
| Neck side-bend hold | 3 × 20 s each side | band, RPE 6 |

| Day 3 (power and trunk) | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 4 × 4 each side | 4 kg, explosive |
| Power clean | 4 × 3 | 72.5 → 82.5% |
| Front squat | 3 × 5 | 67.5 → 77.5% |
| Landmine press | 3 × 6 each arm | RPE 8 |
| Farmer's carry | 3 × 30 m | RPE 8 |
| Pallof press | 3 × 10 each side | RPE 7 |

- **Lighter weeks:** weeks 4 and 8 are 10% lighter, with one set fewer.
- **Power clean:** assumes the athlete has been taught it. If not, swap in a
  kettlebell swing or box jump in the builder.

### 6b. Fight camp strength (8 weeks into a fight)

In camp, sparring and conditioning are the main load. The gym keeps strength
and power with two short, heavy sessions (3 × 3) and very little volume.

| Camp session A | Sets × reps | Load |
|---|---|---|
| Countermovement jump | 3 × 3 | bodyweight |
| Trap bar deadlift | 3 × 3 | 77.5–85% |
| Bench press | 3 × 3 | 77.5–85% |
| Pull-up | 3 × 5 | RPE 7 |
| Neck flexion and extension holds | 2 × 20 s each | band, RPE 6 |

| Camp session B | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 3 × 4 each side | 4 kg |
| Bulgarian split squat | 3 × 5 each leg | RPE 7 |
| Landmine press | 3 × 5 each arm | RPE 7 |
| Inverted row | 3 × 8 | bodyweight |
| Farmer's carry | 2 × 30 m | RPE 7 |
| Neck side-bend hold | 2 × 20 s each side | band, RPE 6 |

| Week | What happens |
|---|---|
| 1–6 | Sessions A and B at 80, 82.5, 85, 77.5, 80, 82.5% |
| 7 | The same sessions at 70%, two sets each, about a fortnight out |
| 8 (fight week) | One primer only: jumps, a light medicine ball chest pass, inverted rows and a light neck hold. No barbell work |

The content test enforces this taper: nothing above 70% in the last
fortnight, and no barbell work in fight week.

## 7. Tennis (amateur, pro)

**Why this structure:** tennis is repeated short sprints with constant
lateral movement, deceleration and rotation. Its typical injuries are:
- **Shoulder:** weak external rotation and imbalance from serving.
- **Elbow:** lateral elbow pain (tennis elbow).
- **Groin and hip:** from lateral movement.
- **Lower back:** from rotation.

So the programmes cover:
- **Every week:** rotator-cuff work (external rotation).
- **Elbow and groin:** wrist extension for the elbow, hip adduction for the
  groin.
- **Power:** rotational medicine ball throws, lateral bounds and the 5-10-5
  shuttle, on top of heavy bilateral lifting.

### 7a. Tennis off-season build (3 days a week · 8 weeks)

| Day 1 (lower and lateral) | Sets × reps | Load |
|---|---|---|
| Lateral bound | 4 × 4 each side | bodyweight, stick the landing |
| Trap bar deadlift | 4 × 5 | 72.5 → 80% |
| Bulgarian split squat | 3 × 6 each leg | RPE 8 |
| Lateral lunge | 3 × 6 each side | RPE 7 |
| Hip adduction (machine) | 2 × 10 | RPE 7 |
| Single-leg calf raise | 2 × 10 each leg | RPE 8 |

| Day 2 (upper and shoulder) | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 4 × 4 each side | 3 kg, explosive |
| Landmine press | 3 × 6 each arm | RPE 8 |
| Chin-up | 3 × 6 | RPE 8 |
| Single-arm dumbbell row | 3 × 8 | RPE 8 |
| Side-lying external rotation | 3 × 12 each arm | RPE 7 |
| Face pull | 2 × 15 | RPE 7 |
| Dumbbell wrist extension | 2 × 15 | RPE 7 |

| Day 3 (speed and full body) | Sets × reps | Load |
|---|---|---|
| 5-10-5 shuttle | 5 × 20 m | full recovery |
| Back squat | 4 × 5 | 72.5 → 80% |
| Single-leg RDL | 3 × 6 each leg | RPE 8 |
| Cable woodchop | 3 × 8 each side | RPE 7 |
| Pallof press | 3 × 10 each side | RPE 7 |

Weeks 4 and 8 are lighter.

### 7b. Tennis tournament-season maintenance (2 days a week · 12 weeks)

| Early-week session | Sets × reps | Load |
|---|---|---|
| Lateral bound | 3 × 3 each side | bodyweight |
| Trap bar deadlift | 3 × 3 | 80–85% |
| Landmine press | 3 × 5 each arm | RPE 7 |
| Side-lying external rotation | 2 × 12 each arm | RPE 7 |
| Pallof press | 2 × 10 each side | RPE 7 |

| Mid-week session | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 3 × 4 each side | 3 kg |
| Bulgarian split squat | 3 × 5 each leg | RPE 7 |
| Single-arm dumbbell row | 3 × 8 | RPE 7 |
| Hip adduction (machine) | 2 × 10 | RPE 7 |
| Dumbbell wrist extension | 2 × 15 | RPE 7 |

In a tournament week, the athlete does the early session only, as the listing
says. Every fourth week is lighter.

## 8. Cricket (amateur, pro)

**Why this structure:** the gym work for cricket serves four demands:
- **Rotational power:** for batting, bowling and throwing.
- **Short acceleration:** between the wickets and in the field.
- **The throwing shoulder.**
- **Fast bowlers:** the sport's biggest injury risk. They take most of
  cricket's injuries:
  - lumbar stress injuries in young quicks;
  - side strain (internal oblique), on the non-bowling side;
  - hamstring and groin strains.

  At front-foot contact, the bowler lands on a braced front leg at several
  times bodyweight. So the programmes build:
  - landing and single-leg strength;
  - eccentric hamstring strength (Nordic curls);
  - groin strength (hip adduction);
  - lateral trunk strength (side plank, Pallof press);
  - back-extensor endurance.

  Bowling workload itself is the coach's to manage. These programmes cover
  the gym.

Fast bowlers get their own off-season (8a-ii); batters, spinners and keepers
keep the off-season build, which still carries the bowler basics because most
club cricketers do more than one job. Both share the in-season programme.

### 8a. Cricket off-season: batters and spinners (3 days a week · 8 weeks)

| Day 1 (lower strength and landing) | Sets × reps | Load |
|---|---|---|
| Broad jump to stick | 4 × 3 | bodyweight, hold the landing |
| Trap bar deadlift | 4 × 5 | 72.5 → 80% |
| Bulgarian split squat | 3 × 6 each leg | RPE 8 |
| Nordic curl | 3 × 4 | bodyweight |
| Hip adduction (machine) | 2 × 10 | RPE 7 |
| Single-leg calf raise | 2 × 10 each leg | RPE 8 |

| Day 2 (upper strength and rotation) | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 4 × 4 each side | 4 kg, explosive |
| Landmine press | 3 × 6 each arm | RPE 8 |
| Pull-up | 3 × 5–8 | RPE 8 |
| Single-arm dumbbell row | 3 × 8 | RPE 8 |
| Side-lying external rotation | 3 × 12 each arm | RPE 7 |
| Side plank | 3 × 30 s each side | bodyweight |

| Day 3 (speed and full body) | Sets × reps | Load |
|---|---|---|
| 20 m acceleration | 5 × 1 | full recovery |
| Back squat | 4 × 5 | 72.5 → 80% |
| Single-leg RDL | 3 × 6 each leg | RPE 8 |
| Half-kneeling Pallof press | 3 × 10 each side | RPE 7 |
| Back extension | 2 × 10 | bodyweight, controlled |
| Bird dog | 2 × 8 each side | bodyweight |

Weeks 4 and 8 are lighter (−10%, one set fewer).

### 8a-ii. Cricket off-season: fast bowlers (3 days a week · 8 weeks)

**Why a separate programme:** fast bowlers carry cricket's highest injury
load - lumbar stress injury, side strain, hamstrings, and a front-foot
landing at several times bodyweight every delivery. Their off-season is built
around those:

| Day | Session |
|---|---|
| Lower strength and front-foot landing | Broad jump to stick; **trap bar deadlift**; single-leg drop to stick (the delivery stride); Bulgarian split squat; Nordic curl; Copenhagen plank |
| Trunk and bowling shoulder | Rotational medicine ball throw; landmine press; pull-up; side plank 40 s (front-arm side last); half-kneeling Pallof press; side-lying external rotation |
| Speed and posterior chain | 20 m accelerations; **back squat**; single-leg RDL; back extension (neutral spine); single-leg calf raise; bird dog |

No loaded spinal flexion with rotation anywhere - the lumbar stress pattern.
Main lifts as 8a. Bowling workload stays with the coach.

### 8b. Cricket in-season maintenance (2 days a week · 12 weeks)

| Early-week session | Sets × reps | Load |
|---|---|---|
| Countermovement jump | 3 × 3 | bodyweight |
| Trap bar deadlift | 3 × 3 | 80–85% |
| Landmine press | 3 × 5 each arm | RPE 7 |
| Nordic curl | 2 × 4 | bodyweight |
| Side-lying external rotation | 2 × 12 each arm | RPE 7 |

| Mid-week session | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 3 × 4 each side | 4 kg |
| Bulgarian split squat | 3 × 5 each leg | RPE 7 |
| Single-arm dumbbell row | 3 × 8 | RPE 7 |
| Hip adduction (machine) | 2 × 10 | RPE 7 |
| Side plank | 2 × 30 s each side | bodyweight |

The listing gives two scheduling rules:
- **Multi-day match week:** do the early session only.
- **Bowlers:** never lift the day before or after a long spell.

Every fourth week is lighter.

**For the coach:** under-18 fast bowlers are the highest-risk group for
lumbar stress injury. Under-18s can't sign up in the beta, so these
programmes are written for adults only.

## 9. Athletics: sprints and jumps, and throws (amateur, pro)

**Why this structure:** sprinting, jumping and throwing are decided by how
much force an athlete can produce, and how fast. So the gym builds three
things:
- **Maximal strength:** heavy squats and bench press.
- **Rate of force development:** power cleans, jumps and medicine ball
  throws.
- **Robustness for sprinters:** sprinters' most common injury is the
  hamstring strain. Nordic curls cut it, calf strength supports ground
  contacts, and hip flexor work drives the knee.

The sprints, run-ups and throws themselves happen on the track with the
coach. The gym doesn't duplicate them.

The off-season programme moves from general strength (5s) to max strength
(3s) to power (2s). That's the classic order: strength first, then turning
it into speed. Each four-week block ends with a lighter week.

Throwers need more strength than sprinters, and more of it, so they have
their own programme (9c).

### 9a. Sprint and jump power (off-season · 3 days a week · 12 weeks)

| Main lifts (squat, bench) | Weeks 1–4 | Weeks 5–8 | Weeks 9–12 |
|---|---|---|---|
| Sets × reps | 4 × 5 | 4–5 × 3 | 3–4 × 2 |
| Load | 72.5 → 77.5% (65% week 4) | 80 → 85% (72.5% week 8) | 85 → 90% (75% week 12) |
| Power clean | 4 × 3, 70 → 75% | 4 × 3, 77.5 → 82.5% | 4 × 2, 82.5 → 87.5% |

| Lower strength | Sets × reps | Load |
|---|---|---|
| Box jump | 4 × 3 | bodyweight, step down |
| Back squat | as above | as above |
| Romanian deadlift | 3 × 6 | RPE 8 |
| Nordic curl | 3 × 4 | bodyweight |
| Single-leg calf raise | 3 × 8 each leg | RPE 8 |

| Upper strength and throws | Sets × reps | Load |
|---|---|---|
| Backward overhead medicine ball throw | 4 × 4 | 4 kg, explosive |
| Bench press | as above | as above |
| Pull-up | 3 × 5–8 | RPE 8 |
| Single-arm dumbbell row | 3 × 8 | RPE 8 |
| Medicine ball rotational throw | 3 × 4 each side | 4 kg |
| Side plank | 2 × 30 s each side | bodyweight |

| Power | Sets × reps | Load |
|---|---|---|
| Repeated broad jump | 4 × 3 | bodyweight |
| Power clean | as above | as above |
| Bulgarian split squat | 3 × 5 each leg | RPE 8 |
| Cable hip flexion | 2 × 8 each leg | RPE 7 |
| Pallof press | 2 × 10 each side | RPE 7 |

The power clean assumes the athlete has been taught it.

### 9b. Athletics competition season (sprints, jumps and throws · 2 days a week · 12 weeks)

| Early-week session | Sets × reps | Load |
|---|---|---|
| Box jump | 3 × 3 | bodyweight |
| Back squat | 3 × 3 | 80–85% |
| Power clean | 3 × 2 | 75–80% |
| Nordic curl | 2 × 4 | bodyweight |
| Single-leg calf raise | 2 × 8 each leg | RPE 8 |

| Mid-week session | Sets × reps | Load |
|---|---|---|
| Backward overhead medicine ball throw | 3 × 3 | 4 kg |
| Bench press | 3 × 3 | 80–85% |
| Pull-up | 3 × 5 | RPE 7 |
| Cable hip flexion | 2 × 8 each leg | RPE 7 |
| Side plank | 2 × 30 s each side | bodyweight |

- **Competition week:** do the early session only, and never in the 48 hours
  before a competition.
- **Lighter weeks:** every fourth week.

### 9c. Throws strength and power (off-season · 4 days a week · 12 weeks)

**Why this structure:** shot, discus, hammer and javelin are decided by
maximal strength and how fast it's delivered, with far less concern for body
mass than in sprinting. Throwers lift heavier and more often: four days,
moving from 5s to 3s to doubles and singles (peaking at 92.5%), with a heavy
(6 kg) medicine-ball throw in three of the four sessions - backward overhead
for the shot drive, rotational for discus and hammer, scoop toss for the
whole-body extension.

| Main lifts (squat, bench) | Weeks 1–4 | Weeks 5–8 | Weeks 9–12 |
|---|---|---|---|
| Sets × reps | 5 × 5 | 5 × 3 | 5 × 2 → 4 × 1 |
| Load | 72.5 → 77.5%, week 4 65% | 82.5 → 87.5%, week 8 75% | 87.5 → 92.5%, week 12 80% |

| Day | Session |
|---|---|
| Squat and back throw | Backward overhead medicine ball throw; **back squat**; Romanian deadlift; calf raise; side plank |
| Bench and rotation | Rotational medicine ball throw; **bench press**; incline bench; pull-up; woodchop; band external rotation |
| Clean and front squat | Scoop toss; **power clean** (to 85%); front squat; back extension; Copenhagen plank |
| Overhead and upper volume | **Overhead press**; one-arm row; dumbbell bench; wrist curl; Pallof press |

## 10. Strongman (amateur, pro · 4 days a week · 12 weeks)

**Why this structure:** three gym days build the base lifts. A separate
event day trains the implements. Event days are hard (RPE 7–9) but never a
max attempt every week. Grip-heavy implements (stones, farmer's, axle) share
one day, so grip and biceps get recovery.

| Main lifts (log, deadlift, squat) | Weeks 1–4 | Weeks 5–8 | Weeks 9–11 | Week 12 |
|---|---|---|---|---|
| Sets × reps | 4 × 5 | 5 × 3 | 4 × 2 → 3 × 1 | 2 × 2 |
| Load | 70 → 75% (65% week 4) | 80 → 85% (72.5% week 8) | 87.5 → 92.5% | 75% |

The squat runs 2.5% under the log and deadlift.

| Overhead day | Deadlift day | Event day (RPE 7 → 9) | Squat day |
|---|---|---|---|
| Log press (main) | Deadlift (main) | Rotates weekly - see below | Back squat (main) |
| Axle press / circus dumbbell / Viking press (rotating) | Axle deadlift / frame deadlift (alternating) | | Sandbag lunge 3 × 10 RPE 7 |
| One-arm row 3 × 10 | RDL 3 × 8, barbell row 4 × 8 | | Pull-up 4 × 5–8 |
| Face pull, triceps | Plank | | Side plank |

**The event day rotates through the implements contests use**, a different
set each week of a four-week block:

| Week | Events |
|---|---|
| 1 | Yoke, farmer's walk (real handles), stone to platform, tyre flip |
| 2 | Frame carry, keg carry, stone over bar, sandbag to shoulder |
| 3 | Husafell stone carry, duck walk, keg load, vehicle pull |
| 4 | A timed medley: yoke, sandbag, farmer's, stones, one run each against the clock |

The pro version's second event day adds the other overhead event, a vehicle
pull or Conan's wheel, tyre and a Hercules hold.

**For the coach:**
- **Contest events:** every event-day note says to swap in the contest's
  implement, weight and distance once the events are announced - a contest
  prep trains the events in the contest.
- **Stones:** loaded to a platform on odd weeks and over a bar on even
  weeks; the axle deadlift trains grip and the common contest deadlift.
- **Event weights:** these are by effort. Contest weights belong to the
  athlete.

## 11. Street lifting (amateur, pro · 3 days a week · 12 weeks)

**Why this structure:** the competition lifts are bodyweight plus added
load, so they're prescribed by effort. The athlete adds weight (belt or
vest) to reach the RPE and logs the added weight. The waves run 5s → 3s →
doubles and singles with a lighter week every fourth, then a taper, like a
powerlifting peak.

Dips and heavy pulling are hard on elbows and shoulders, so every week has
rotator-cuff work (band and side-lying external rotation), face pulls and
high-rep triceps. Volume rises only through the planned waves.

| Week | Heavy day: pull-up and dip | Second heavy day |
|---|---|---|
| 1–3 | 5 × 5 at RPE 7 → 5 × 4 at RPE 8 | +1 rep, 1 RPE easier |
| 4 | 3 × 5 at RPE 6 (lighter) | |
| 5–7 | 5 × 3 at RPE 8 → 4 × 3 at RPE 9 | |
| 8 | 3 × 3 at RPE 6 (lighter) | |
| 9–11 | 4 × 2 at RPE 8 → 3 × 1 at RPE 9 | |
| 12 | 2 × 1 at RPE 7 (taper) | |

The squat is in for federations that include it; otherwise it's leg
strength. Muscle-ups are practised strict and fresh.

**For the coach:**
- **Depth and lockout standards:** these vary by federation, so the notes
  defer to the athlete's federation.
- **Estimated maxes:** the app's estimated max for these lifts is on the
  added weight. A true street-lifting e1RM includes bodyweight. That's a
  product gap, noted in the review.

## 12. HYROX (amateur, pro · 5 days a week · 12 weeks)

**Why this structure:** HYROX is 8 × 1 km runs, each followed by a station,
in a fixed order:

1. SkiErg 1,000 m
2. Sled push
3. Sled pull (hand over hand on a rope)
4. Burpee broad jumps 80 m
5. Row 1,000 m
6. Farmer's carry
7. Sandbag lunges
8. Wall balls

The deciding quality is **compromised running**: running well straight
after station work - and the running itself is half the race. So the
programme has five days:
- **Strength:** squat, RDL, a heavy sled push and pull-ups.
- **Compromised running:** rounds of a 1 km run straight into a pair of
  stations, as one For Time piece. The pair rotates through all eight
  stations in race order week by week, and rounds build from 2 to 4.
- **Race simulation in week 10:** all eight stations in order, with a 1 km
  run before each pair (4 km of running). The builder can't hold the same
  exercise twice in one session, so it's 4 × 1 km rather than 8. Then a
  taper.
- **Station strength-endurance:** an AMRAP of wall balls, sandbag lunges,
  farmer's carry and rowing, plus hard SkiErg repeats.
- **Threshold run:** 2–4 repeats of 6–15 minutes at a comfortably hard
  effort (a pace you could hold for about an hour), 2 minutes easy between.
- **Easy run:** 5–10 km at conversational pace - the aerobic base the
  whole race runs on.

**Division weights** (Open/Pro, men's/women's) are never set here. Every
station note says to use your division's race weight. The sled pull is the
race's rope pull, hand over hand from the box.

## 13. CrossFit (amateur, pro · 4 days a week · 8 weeks)

**Why this structure:** strength or skill comes first while fresh, then one
conditioning piece a day, in a deliberately different time domain:

| Day | First | Then |
|---|---|---|
| 1 | Back squat 5 × 5 | **For Time** (8 min cap) |
| 2 | Power clean + push jerk 5 × 2 | **AMRAP** 12 min |
| 3 | Strict pull-ups, strict handstand push-ups | **EMOM** 12 min |
| 4 | Snatch 5 × 2 | **Chipper For Time** (20 min cap) |

**Varied, with a benchmark:** each time domain has four different workouts
that rotate week to week (thrusters and pull-ups; wall balls and
toes-to-bar; rowing and burpees; deadlifts and box jumps for the short For
Time, and so on), so no workout repeats inside a four-week wave. Week 1's
short For Time is a benchmark: logged, then repeated in week 8 to show what
the eight weeks did.

- **Gymnastics:** strict comes before kipping. The notes say kip only with
  10 strict pull-ups.
- **Olympic lifts:** always in doubles, never high reps under fatigue.
- **Scoring:** Rx or scaled is logged.
- **Lighter weeks:** weeks 4 and 8, with shorter caps.

## 14. Olympic weightlifting (amateur, pro · 4 days a week · 12 weeks)

**Why this structure:** technique limits the classic lifts, so the snatch
and clean & jerk come **first in every session**, in low reps, and never
for high reps under fatigue.

| Snatch and clean & jerk | Weeks 1–4 | Weeks 5–8 | Weeks 9–11 | Week 12 |
|---|---|---|---|---|
| Sets × reps | 5 × 3 | 5 × 2 | 5 × 1 → 4 × 1 | 3 × 1 openers |
| % of your best | 70 → 75% (65% week 4) | 77.5 → 82.5% (70% week 8) | 85 → 90% | 85% |

The fourth day repeats both lifts 2.5% heavier.

**Squats** (back and front) build strength underneath: 5s, then 3s, then
doubles.

**Pulls and variants** (snatch and clean pulls, power snatch, hang power
clean, hang snatch) are set by effort. Each one's note gives the usual
percentage of the lift: pulls about 95–105%, power variants 70–80%. A
weightlifting coach writes pulls as a % of the snatch or clean, but the app
takes a % only from an exercise's own max, so effort plus the note is the
honest version.

| Snatch and back squat | Clean & jerk and front squat | Power and hang | Heavy day |
|---|---|---|---|
| Snatch (main) | Clean & jerk (main) | Power snatch 4 × 2 | Hang snatch primer |
| Overhead squat 3 × 3 | Split jerk 3 × 2 from the rack | Hang power clean 4 × 2 | Snatch +2.5% |
| Back squat (main) | Front squat | RDL, pull-ups | Clean & jerk +2.5% |
| Snatch pull 4 × 3 | Clean pull 4 × 3 | Plank | Back squat, lighter |

**Taper (week 12):** openers practised at 85% (a weight you'd make on a bad
day), and a light primer of power snatch, hang power clean and split jerk.

**For the coach:**
- **Clean & jerk logging:** the note asks the athlete to log which part
  missed. The app records a clean & jerk as one exercise, so a coach reads
  the note rather than a separate clean and jerk result.
- **Weight class:** the programme adds no hypertrophy block. Making weight
  is for the athlete and their coach.

## 15. Pro versions of the sport builds (pro only)

A full-time athlete has the recovery for more work and the training age for
advanced methods. So the sport builds each have a pro version: the four
team off-seasons (collision forwards, collision backs, field and ice, court),
tennis, cricket, combat, sprint and jump, run and ride, triathlon, and swim,
row and paddle.

- **Contrast pairs:** a session that led with a jump, throw or sprint before
  a heavy lift flips the order into a pair: the heavy set first, then
  straight into the explosive work while the athlete is primed, then full
  rest. This is the classic complex/contrast method for turning strength
  into power.
- **One more working set** on the main lifts, never more than 6.
- **Everything else is unchanged:** loads, lighter weeks, and the robustness
  and sport-specific work.

The pro version is listed for pros only and shown to them first. The
amateur build stays available to pros too, for a lighter phase or after
time away. In-season, race-season and fight-camp programmes stay shared
between amateur and pro, because the minimum effective dose doesn't change
with level.

**For the coach:**
- **Built from the amateur builds:** the pro versions are generated from
  them in the content file, so changes there carry over. In the builder
  they're separate programmes, so edit either freely once you've reviewed
  them.
- **Position splits:** collision sports split forwards and linemen from
  backs and skill players; cricket splits fast bowlers from batters and
  spinners; athletics splits sprinters and jumpers from throwers.
- **Strength-sport and hybrid preps** have their own pro versions (section 17).

## 16. Sport foundations for beginners (beginner only)

Most beginners start on Beginner full-body. Where the sport's own skills are
lifts, stations or movements to learn, or where contact makes neck and
hamstring work non-negotiable from day one, a beginner gets their sport's
own foundation instead (listed first for them):

| Programme | Sports | What's different from Beginner full-body |
|---|---|---|
| Contact-sport foundation | rugby (all three), American football, all six combat sports | The same main lifts, plus Nordic curls and gentle neck holds (RPE 5) from week one |
| Field, court and racket foundation | football, field hockey, ice hockey, netball, basketball, volleyball, cricket, tennis | The same main lifts, plus Nordic curls, Copenhagen planks (short lever) and landing practice from week one |
| Weightlifting foundation | Olympic weightlifting | The snatch and clean & jerk every week, light and perfect (triples and doubles at RPE 6–7), power and hang variants, pulls, squats |
| Street lifting foundation | street lifting | Eight weeks of strict bodyweight pull-up and dip volume, then the first weighted sets; tendon care every week |
| CrossFit on-ramp | CrossFit | Barbell basics, banded strict gymnastics, one short scaled workout a day |
| HYROX first race | HYROX | Full-body strength, all eight stations learned light (half race dose) every four weeks, an easy run building to 6 km |

Each leads on to the sport's amateur programme when it's finished.

## 17. Pro versions of the strength and hybrid preps (pro only)

Full-time lifters and racers differ from amateurs in how often they train and
how close to their max they work. Each pro prep adds a day built around
that, and the lifting preps peak at 95%. Taper weeks are unchanged.

| Pro prep | Added day |
|---|---|
| Powerlifting meet prep | A heavy single (RPE 7 → 9 by block) with back-off sets on a paused variation, rotating squat, bench and deadlift; the last peak week at 95% |
| Olympic weightlifting meet prep | Heavy singles in the snatch and clean & jerk: by effort in the build, then 90, 92.5 and 95% in the peak |
| Strongman | A second event day: the other stone event, axle clean and press, a vehicle-pull stand-in, tyre, grip |
| Street lifting | Heavy weighted pull-up and dip singles (RPE 7 → 9) with muscle-up practice |
| HYROX | Race-pace 1 km intervals with heavy sled push and pull |
| CrossFit | Gymnastics volume (muscle-ups, rope climbs) and a long aerobic piece |

## Not in v1, and why

- **Women-specific or youth programmes:** under-18s can't sign up in the beta.
- **Conditioning prescriptions:** these programmes cover the gym; sport
  conditioning stays with the sport.

## Sources (principles, not copied programmes)

- Linear progression for novices; heavy/light and weekly progression for
  intermediates. Standard practice: NSCA *Essentials of Strength Training
  and Conditioning*; Rippetoe and Baker, *Practical Programming for Strength
  Training*.
- Block periodisation (accumulation → intensification → realisation): Issurin,
  *Block Periodization* (2008).
- Rep/intensity zones for % prescriptions: Prilepin's table, already in the
  builder.
- In-season maintenance: Rønnestad et al. (2011), strength maintained with one
  heavy session a week in professional football.
- Nordic hamstring exercise and hamstring injury risk: Petersen et al. (2011);
  van der Horst et al. (2015).
- Copenhagen adduction exercise and groin problems in football: Harøy et al.
  (2019). FIFA 11+ injury prevention: Soligard et al. (2008).
- Neck strengthening in rugby (World Rugby Activate): Attwood et al. (2018).
- Isometric holds for patellar tendon pain: Rio et al. (2015).
- Heavy strength training and plyometrics for endurance performance
  (better economy; no added mass when volume is low): Rønnestad and Mujika
  (2014); Beattie et al. (2014); Blagrove et al. (2018). One session a week
  maintaining strength in cyclists' racing season: Rønnestad et al. (2010).
- Dry-land strength for swimmers: Crowley et al. (2017).
- Strength and power for weight-class combat athletes: Turner (2009); James
  et al. (2016). Neck strength and head acceleration: Hrysomallis (2016).
- Tapering (keep intensity, cut volume): Mujika and Padilla (2003).
- Tennis demands, external-rotation work and injury patterns: Kovacs and
  Ellenbecker (2011); Fernandez-Fernandez et al. (2014).
- Fast-bowling injury (lumbar stress injury, side strain, hamstring) and
  bowling workload: Orchard et al. (2009, 2015); Hulin et al. (2014).
- Strength, power and sprint performance; strength before power: Suchomel
  et al. (2016, 2018); Haff and Nimphius (2012).
- HYROX race format (8 × 1 km runs, 8 stations in order): HYROX official
  rulebook; station weights are per division and set by the athlete.
- Weighted pull-up and dip standards vary by federation (e.g. WSWCF, ISLF);
  the programme defers to the athlete's federation.
