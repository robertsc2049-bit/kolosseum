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
4. On the programme page, **Publish to athletes**: confirm the title, summary,
   levels, sports and days a week (suggested values for each are in the file
   above), then publish.
5. Once both halves of a pair are published, set **When athletes finish it,
   offer next** on each (the seed script prints the pairs, below).

Athletes see a programme only once it is published.

### What comes next

When an athlete finishes a programme, they're offered the one it leads to,
or they can run it again or choose another:

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

Nine programme families for athletes training without a coach. Each one is
written as an ordinary programme in the builder, so it can be edited there
before it's published. Nothing reaches athletes until it's reviewed,
activated and listed.

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
building weeks, then a deload), and the second wave starts 2.5% higher.

| Upper 1 (strength) | Sets × reps | Load |
|---|---|---|
| Bench press | 4 × 5 | 75 / 77.5 / 80 / 65% |
| Barbell row | 4 × 6 | 70 / 72.5 / 75 / 60% |
| Overhead press | 3 × 6 | 70 / 72.5 / 75 / 60% |
| Pull-up | 3 × 6–8 | RPE 8 |
| Cable triceps pressdown | 3 × 12 | RPE 8 |

| Lower 1 (strength) | Sets × reps | Load |
|---|---|---|
| Back squat | 4 × 5 | 75 / 77.5 / 80 / 65% |
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

| Block | Weeks | Squat / Bench / Deadlift main sets |
|---|---|---|
| Accumulation | 1–4 | 4–5 × 6–8 at 65 → 72.5% (week 4: −10%) |
| Intensification | 5–8 | 5 × 3–4 at 75 → 85% (week 8: −10%) |
| Realisation | 9–11 | 3 × 2 at 87.5 → 90%, then singles at 92.5–95% (week 11) |
| Taper and meet | 12 | Openers ×1 at about 90% early in the week; then rest |

**Sessions each week:**
- Day 1: back squat (main), paused bench press, barbell row, leg curl
- Day 2: bench press (main), close-grip bench press, pull-up, face pull
- Day 3: deadlift (main), paused back squat (variation, lighter), Romanian deadlift, front plank
- Day 4: bench press (variation: Spoto press or paused bench), overhead press, chest-supported row, triceps

**Accessories:** RPE 7–8, dropping in volume through the blocks.

---

## 4. Team-sport strength and conditioning (amateur, pro · field and court sports)

Two programmes, matching the sporting year. They're listed for rugby union,
rugby league, rugby sevens, football, field hockey, ice hockey, American
football, netball, basketball and volleyball.

### 4a. Off-season build (3 days a week · 8 weeks)

**Why this structure:** the off-season is where strength and muscle are built
with the most room for training stress. Each session pairs explosive work done
fresh (jumps, throws, short sprints) with heavy compound lifting. It also
includes the injury-reducing work field and court athletes need: eccentric
hamstring work (Nordic curls) and single-leg strength.

| Day 1 (lower strength) | Sets × reps | Load |
|---|---|---|
| Box jump | 4 × 3 | bodyweight, full rest |
| Back squat | 4 × 5 | 72.5 → 80% |
| Romanian deadlift | 3 × 8 | 65 → 70% |
| Bulgarian split squat | 3 × 6 each leg | RPE 8 |
| Nordic curl | 3 × 4 | bodyweight |

| Day 2 (upper strength) | Sets × reps | Load |
|---|---|---|
| Medicine ball chest pass | 4 × 5 | explosive |
| Bench press | 4 × 5 | 72.5 → 80% |
| Pull-up | 4 × 6 | RPE 8 |
| Single-arm dumbbell row | 3 × 10 | RPE 8 |
| Side plank | 3 × 30 s each side | bodyweight |

| Day 3 (power and full body) | Sets × reps | Load |
|---|---|---|
| 10 m acceleration | 6 × 1 | full recovery |
| Trap bar deadlift | 4 × 4 | 75 → 82.5% |
| Push press / overhead press | 3 × 5 | 70 → 77.5% |
| Walking lunge | 3 × 8 each leg | RPE 8 |
| Pallof press | 3 × 10 each side | RPE 7 |

Week 4 and week 8 are lighter (−10%, a third fewer sets).

### 4b. In-season maintenance (2 days a week · 12 weeks, repeatable)

**Why this structure:** in season the priority is keeping the strength and
power built in the off-season while staying fresh for matches. Research
consistently shows strength holds on 1–2 short, heavy sessions a week, with
low volume at high intensity. The app's match-week setting already keeps
heavy leg work away from the day before a match.

| Session 1 (early week) | Sets × reps | Load |
|---|---|---|
| Countermovement jump | 3 × 3 | explosive |
| Back squat | 3 × 3 | 80–85% |
| Bench press | 3 × 3 | 80–85% |
| Pull-up | 3 × 5 | RPE 7 |
| Nordic curl | 2 × 4 | bodyweight |

| Session 2 (mid week) | Sets × reps | Load |
|---|---|---|
| Medicine ball rotational throw | 3 × 4 each side | explosive |
| Trap bar deadlift | 3 × 3 | 80–85% |
| Single-arm dumbbell press | 3 × 6 | RPE 7 |
| Inverted row | 3 × 8 | bodyweight |
| Side plank | 2 × 30 s each side | bodyweight |

Every fourth week drops to one set less per lift.

---

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

### 5a. Run and ride strength (athletics, cycling, triathlon · 2 days a week · 12 weeks)

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
| Pallof press | 2 × 10 each side | RPE 7 |

One heavy session a week holds most of the strength built in the off-season.
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

One programme covers every role. Batters and keepers lose nothing from the
bowler-specific work, and most club cricketers do more than one job.

### 8a. Cricket off-season build (3 days a week · 8 weeks)

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

## 9. Athletics sprints, jumps and throws (amateur, pro)

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

Throwers get rotational and backward overhead throws and a bench press every
week. If you coach throwers, add more upper-body pressing in the builder.

### 9a. Sprint, jump and throw power (off-season · 3 days a week · 12 weeks)

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

### 9b. Sprint, jump and throw competition season (2 days a week · 12 weeks)

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

## Not in v1, and why

- **Sport programmes for beginners:** every sport programme is for amateur
  and pro athletes. Beginners in any sport start on Beginner full-body, which
  builds the base the sport programmes assume.
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
