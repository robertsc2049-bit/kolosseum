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

Athletes see a programme only once it is published.

Four programme families for athletes training without a coach. Each one is
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

## Not in v1, and why

- **Endurance, combat and racket-specific programmes:** these athletes get
  the Beginner full-body or Intermediate upper/lower programmes until sport
  programmes are written. Those general programmes suit them well as strength
  training alongside their sport.
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
