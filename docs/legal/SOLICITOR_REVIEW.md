# Terms of Service and Privacy Notice: brief for solicitor review

Prepared November 2026. This is the brief that goes with the two drafts:

- `public/app/legal/terms.html` is the Terms of Service, version `terms_v1`. It is served at `/app/legal/terms.html`.
- `public/app/legal/privacy.html` is the Privacy Notice, version `consent_v1`. It is served at `/app/legal/privacy.html`.

The drafts are written in the style of English law consumer and platform terms. They have not yet been reviewed by a qualified solicitor. Please review them against the facts below, and against the points we have flagged.

## 1. The business and the product

- **The operator.** A sole founder based in England, currently a **sole trader** trading as "Kolosseum", **not VAT registered**, and **not yet registered with the Information Commission** (the data protection fee is to be paid). The founder intends to incorporate a limited company later (see question 11).
- **What Kolosseum is.** A web application (a PWA at app.kolosseum.tools) that strength and conditioning coaches and athletes use to:
  - write and assign programmes;
  - log training;
  - record health and wellbeing information;
  - review that data.

  It also publishes its own general programmes ("Kolosseum Programmes"). Some of these reproduce well-known published programmes, which are shown unaltered with their sources.
- **Users.** Adults only (18 and over). Athletes self-declare their date of birth at sign-up and we keep only the fact that they are 18 or over.
- **Who pays whom.**
  - Coaches pay Kolosseum a subscription via Stripe Checkout.
  - Athletes do not pay Kolosseum.
  - Coaching fees, gym memberships and service packages are agreed and paid **directly** between athlete and coach or gym, off-platform. Coaches can record in the app that a payment was made or is due.
  - Kolosseum never handles that money. An in-app Stripe Connect model, using direct charges, is planned for later and would need these terms revisiting.
- **Health data.** The app records:
  - pain reports and injuries;
  - medical stand-downs;
  - readiness check-ins (sleep, soreness, stress, fatigue, mood);
  - resting heart rate and HRV;
  - body measurements and progress photos;
  - wearable imports.
- **No advice.** The app states facts and explains how to read them, citing published research. It does not tell users what to do. Applying a rule automatically is limited to two cases:
  - fixed rules the user or their coach has chosen to switch on, such as lightening a session after a low readiness check-in (off by default);
  - safety holds the athlete records themselves, such as a medical stand-down.
- **Messaging.** Coaches and athletes can message each other and exchange videos. Coaches can broadcast to their athletes. Gyms list themselves (with admin approval), and athletes can find coaches by gym.
- **Who supplies the service.**
  - IONOS: VPS hosting (location to confirm) and S3 backups in Germany.
  - Resend: email (US).
  - Stripe.
  - Web Push: payloads encrypted to the browser's push service.
  - YouTube: privacy-enhanced embeds of demonstration videos.

  There is no analytics or advertising, and the only cookie is the strictly necessary session cookie.
- **Sign-up wording.** Athletes and coaches tick:
  1. "I am 18 or over and I agree to the Terms of Service (terms_v1)."
  2. "I explicitly consent to Kolosseum using the health information I choose to record (such as pain, injuries and readiness) to provide the service, as set out in the Privacy Notice (consent_v1). I can withdraw this consent at any time."

  Gym owners tick a single box agreeing to the Terms, including the business-user Schedule.

## 2. Law we drafted against (as at 4 November 2026)

- Consumer Rights Act 2015, Parts 1 and 2: services, digital content, unfair terms and transparency.
- Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013: the 14-day cancellation right for subscriptions.
- Unfair Contract Terms Act 1977, ss 2 and 11: the reasonableness of the business-user limitations.
- Digital Markets, Competition and Consumers Act 2024.
  - The unfair commercial practices provisions have been in force since April 2025.
  - The subscription contracts regime is **not yet in force**. The draft Consumer Subscription Contracts (Cancellation and Information) Regulations 2026 were laid before Parliament, and commencement is expected in early 2027.
- UK GDPR and Data Protection Act 2018, as amended by the Data (Use and Access) Act 2025.
  - The main changes commenced on 5 February 2026.
  - The right to complain to the controller (DPA 2018 s164A) applies from 19 June 2026.
  - The ICO became the Information Commission on 30 September 2026 (SI 2026/1015).
- PECR 2003, reg 6: strictly necessary storage only.
- Regulation (EU) 2019/1150 (P2B), as assimilated law in the UK.
- Online Safety Act 2023: the user-to-user messaging features.
- Reporting Platform Operators (Due Diligence and Reporting Requirements) Regulations 2023.

## 3. What has been completed, and what is still open

Completed:
- **Trading status:** sole trader, not VAT registered (Terms 1.2; Privacy 1.1).
- **Ranking parameters (Terms Schedule S.6):** these are taken from the code.
  - Gyms are matched on name or area and then listed alphabetically.
  - Coaches at a gym are the ones the gym has confirmed, listed alphabetically.
  - There is no paid placement.
- **Mediators (Terms Schedule S.9):** CEDR, or a mediator accredited by the Civil Mediation Council and agreed between the parties, with Kolosseum paying a reasonable proportion of the costs. Please confirm this is suitable.
- **Log retention (Privacy 8.4):** server logs are capped at 3 × 10 MB per service, rotated, and deleted on each update. This is enforced in the server configuration.

Still to complete before publication:
1. The founder's full name and trading address (Terms 1.2 and 12.4; Privacy 1.1). If the address is the founder's home, please advise whether a business or service address should be used instead, since it will be public.
2. The contact and privacy email addresses.
3. The effective date.
4. The VPS hosting location (UK or Germany), in Privacy section 6.
5. The Information Commission registration number, once the fee is paid. The line has been removed for now.

## 4. Points on which we would like advice

1. **Bundled explicit consent.** The health-data consent is a required tick at sign-up. Recording health data is optional, and the core service (programmes and logging) works without it. Is consent at sign-up "freely given" (UK GDPR Art 7(4))? Or should explicit consent instead be collected when a user first records health information? Is another Article 9 condition available?
2. **The coach's role under data protection law.** We have described coaches as independent controllers for any use they make of athlete data outside the app, and Kolosseum as controller within it. Does this need joint-controller arrangements (Art 26), or a data processing agreement between Kolosseum and coaches?
3. **Whether P2B applies.** Is Kolosseum an "online intermediation service" for coaches and gyms, given gym listings, find-a-coach and bookable slots, but with no on-platform payment? The Schedule is drafted as if it does.
4. **Online Safety Act 2023.** See also `docs/legal/OSA_RISK_ASSESSMENT.md` (report, block, removal and restriction are now built). Kolosseum is a small user-to-user service, with private messaging and broadcasts between adults. What illegal-content risk assessment, terms and reporting or complaints wording is required? Terms 10.2 and 10.3 are a starting point.
5. **The limitation clauses.**
   - The business-user cap is the greater of 12 months' fees or £100, with a coach indemnity (Terms 17).
   - Consumer losses are limited to foreseeable loss (Terms 16).

   Are these reasonable and fair, given that health and training risks are involved? Is the "no medical advice" clause (Terms 5) prominent and transparent enough (CRA s68)?
6. **Recognised programmes.** Kolosseum reproduces published programmes (for example Starting Strength, 5/3/1 and Westside templates) unaltered, with attribution. Please advise on copyright and database-right exposure, and on whether a licence or a change of approach is needed.
7. **Accounts created before these terms existed.** Accounts created before these drafts ticked a box that referred to "terms_v1" when no terms text yet existed. We propose to issue the solicitor-approved version as `terms_v2` / `consent_v2` and require existing users to accept it at their next sign-in. Is that sufficient?
8. **The DMCC subscription regime.** When it commences (expected 2027), renewal reminders, cooling-off and exit steps will be needed for consumer subscribers. Which coaches count as consumers?
9. **Reporting Platform Operators Regulations 2023.** Do these apply, given that relevant-services consideration is paid off-platform? Schedule S.3 reserves the right to collect seller information.
10. **Insurance.** Please recommend cover: professional indemnity, public liability and cyber.
11. **Incorporation.** The founder plans to move the business into a limited company. How should existing users' contracts (and the data controller role) move across? Terms 21.1 allows a transfer with notice. Should the move be a new terms version that users re-accept, and what changes in the Privacy Notice?

## 5. Known technical follow-ups (not legal drafting)

- Off-site backups are stored in IONOS S3 but are not encrypted by Kolosseum before upload. We recommend client-side encryption (for example, rclone crypt). The Privacy Notice currently claims no more than "restricted access".
- The gym-owner sign-up records `accepted_terms_version` and `accepted_terms_at`. Gym owner accounts created before this change have no record.

## 6. Finding a solicitor (note for the founder)

What to look for:
- A solicitor or firm regulated by the Solicitors Regulation Authority (SRA). You can check any firm on the SRA's register at sra.org.uk.
- Experience in **technology, commercial and data protection** work, ideally with SaaS or online-platform terms. Searching for "SaaS terms of service solicitor" or "data protection solicitor for start-ups" finds firms that do this as a fixed-fee review.
- The Law Society's "Find a Solicitor" search (solicitors.lawsociety.org.uk) lets you filter by area of practice, for example "Data protection" or "Commercial contracts".

What to send them:
1. This brief.
2. The four documents (Terms of Service, Privacy Notice, this brief, and the Online Safety Act risk assessment). They are in the single PDF pack.

What to ask for:
- A fixed-fee review of the four documents against the questions in section 4.
- Marked-up changes, plus a short list of anything Kolosseum must do outside the documents, such as ICO registration or Online Safety Act records.
- Their view on incorporation timing (question 11).
