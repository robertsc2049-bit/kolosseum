# Online Safety Act 2023: illegal content risk assessment

| | |
|---|---|
| **Service** | Kolosseum (app.kolosseum.tools) |
| **Provider** | [legal name], see the Terms of Service clause 1 |
| **Assessment date** | November 2026 (first assessment) |
| **Next review** | November 2027, or sooner on a significant change. A significant change includes: adding public or group chat, user profiles visible to strangers, or under-18 users; growth beyond a small number of UK users; or Ofcom guidance that changes the expectations below. |
| **Prepared by** | Kolosseum, for review by a solicitor alongside the Terms of Service and Privacy Notice (see `SOLICITOR_REVIEW.md`). |

This record follows the structure of Ofcom's illegal content risk assessment guidance for user-to-user services. It should be checked against Ofcom's current guidance and codes when it is reviewed.

## 1. Is Kolosseum a regulated service?

Yes, as a user-to-user service. Users can send content to other users:

- one-to-one messages between a coach and their athlete;
- messages between an organisation (gym) owner and their coaches or athletes;
- a coach's broadcast to their own athletes;
- an organisation owner's broadcast to its coaches or athletes;
- photos and videos attached to those messages, and videos athletes upload for their coach's feedback.

Kolosseum is not a search service and publishes no pornographic content. Users must be 18 or over (Terms 3.1). Kolosseum is not likely to be accessed by children, so the children's safety duties are not assessed here. This should be re-checked if the age policy changes.

## 2. How users can encounter content (functionalities)

| Functionality | Present | Notes |
|---|---|---|
| Public posting / feeds / comments | No | Nothing a user writes is visible to the public or to users they have no relationship with. |
| Messaging between users | Yes | Only within an existing relationship: an accepted coach–athlete relationship, an active organisation membership, or an athlete coached within an organisation whose owner has chosen shared visibility. Strangers cannot message each other. |
| Group messaging / broadcast | Limited | One-to-many from a coach or organisation owner to their own athletes or coaches only; recipients cannot reply to the group. |
| Images and video | Yes | Attachments to messages, and form-check videos sent to a coach. Not public. |
| User search / discovery | Limited | Athletes can find coaches by gym and send a coaching request; no messaging until the coach accepts. Gym listings are approved by an admin before they appear. |
| Anonymous or unverified accounts | Partly | Accounts need an email address. Identity is not verified. |
| Encryption | In transit only | Kolosseum can read messages when it needs to act on a report. |

## 3. Risk of each kind of priority illegal content

Each kind is rated on likelihood (how likely it is to appear on Kolosseum) and impact (the harm if it does). Ratings are low, medium or high, judged against the functionalities above.

| Priority illegal content | Risk | Reasoning |
|---|---|---|
| Harassment, stalking, threats, abuse (including coercive control) | **Medium** | The most likely harm. Coach–athlete relationships involve a power imbalance, frequent private contact, and often body and diet information. |
| Intimate image abuse; sexual exploitation of adults | **Medium** | Private image and video sharing between people in a close working relationship. |
| Child sexual exploitation and abuse | **Low** | 18+ only, no discovery between strangers, no public content. The age check is self-declared, and image sharing exists. |
| Fraud and financial offences | **Low-medium** | Coaches take payment off the platform, so scams by people posing as coaches are possible. |
| Hate offences | **Low** | No public content; messages only within existing relationships. |
| Encouraging or assisting suicide or serious self-harm | **Low-medium** | Training, weight and body-image contexts. |
| Drugs (including prohibited performance-enhancing substances) and weapons offences | **Low-medium** | Sport context; possible supply of prohibited substances. |
| Terrorism, extreme pornography, other priority offences | **Low** | No relevant functionality for spread to the public. |

**Overall:** a small, low-risk service, with a **medium risk of harassment and intimate image abuse in private messaging**.

## 4. Measures in place

1. **Terms of Service clause 10** sets out what is not allowed. It explains how users can report content, what Kolosseum may do in response, and that reports may be passed to the police.
2. **Reporting.** A **Report** action sits under every message a user receives, including broadcasts and attachments. This applies to coaches and athletes in the app, and to gym and organisation owners in the organisation console.
   - The user chooses a reason: abuse or harassment, threats, sexual content, spam or scam, illegal, or other. They can add an optional note.
   - A snapshot of the reported message is kept as evidence.
   - The sender is not told who reported it.
   - The report form reminds users to call 999 if they are in danger.
3. **Blocking.** A **Block** action under every received message stops that person's messages and broadcasts reaching the user. Users can unblock under Account. Blocking doesn't end a coaching relationship. A gym or organisation owner who blocks someone stops that person's messages reaching all of their organisations, and can unblock them under Account in the organisation console.
4. **Review and action.** An admin reviews every report in the admin console, seeing the message and the messages before it. The admin then decides one of three outcomes:
   - **dismiss** the report;
   - **remove** the message: both people see "removed by Kolosseum", and the text and attachment are no longer served;
   - **remove and restrict** the sender: they cannot send messages until the restriction is lifted.

   Every decision records who made it, when, and the reason.
5. **Telling people the outcome.** The reporter is notified of the outcome. The sender is notified of the removal and the reason, which is the statement of reasons required by Terms 10.2 and Schedule S.5. Each notification opens the conversation concerned: an athlete's messages for a coach, and that organisation's messages for an organisation owner.
6. **Complaints.** Users can complain about a decision via "Report a problem" (Terms 20). Account suspension for serious or repeated breaches uses the existing admin account controls.
7. **Structural limits.** There is no public content, no messaging between strangers, adults only, and gym listings need admin approval.

## 5. Record-keeping and review

- **Records kept.** Reports, decisions, removals and restrictions are kept in the database (`product_message_reports`, `product_messaging_restrictions`, and `product_messages.removed_at`).
- **Personal data.** These records are included in the user's data export, and removed on erasure.
- **Response time.** Reports are reviewed at least daily while the beta has a small number of users. The open queue appears on the admin console.
- **When to review this assessment.** On any change listed under "Next review" above, and whenever a report reveals a kind of harm not assessed here.

## 6. Open points for the solicitor

- **Ofcom documents.** Confirm which current codes of practice apply to a small, low-risk user-to-user service, and whether any further record or measure is expected. This could include a named person accountable for online safety, or a written content-moderation policy.
- **Reporting to the police and NCA.** Confirm the duty and process for reporting child sexual exploitation and abuse content to the National Crime Agency, should any ever be found.
- **Wording.** Confirm the Terms of Service wording on reporting and complaints meets the Act's requirements for user-to-user services.
