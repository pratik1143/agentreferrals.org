# AgentReferrals.org — Phase 1 product definition

## Executive summary

A responsive B2B referral marketplace for verified real-estate professionals. The primary journey is **verify → post → discover → apply → review → select → track → close**. Phase 1 is product definition and interface design; Phase 2 begins authentication and profile implementation. The accompanying HTML is a clickable, responsive UI concept, not a connected production application.

## Scope translated from the proposal

### Phase 1 outputs
- Confirm roles, key workflows, information architecture, responsive strategy, and admin structure.
- Establish the data model and access-control plan.
- Deliver a consistent interface direction and wireframe-level screens.

### Core screens represented in the prototype
- Professional overview: performance cards, recent activity, opportunities, and referral journey.
- Marketplace: searchable/refinable opportunity feed.
- My referrals, applications, and deal pipeline navigation and list patterns.
- Professional profile entry point.
- Admin overview and verification queue.
- Referral posting form concept.

### Explicitly later-phase work
- Firebase-backed accounts, password reset, email verification, profile completion, document upload, and approval workflow: Phase 2.
- Persistent referral creation, full marketplace search, saved referrals: Phase 3.
- Applications, accept/reject, assignment, agreements, notifications, and PRO billing: Phase 4.
- Production admin tools, QA, hardening, and deployment: Phase 5.

## Roles and permissions proposal

| Capability | Professional | Super admin |
|---|---|---|
| Read published referrals | Yes | Yes |
| Create/edit own referrals | Yes | Yes, moderation as needed |
| Apply to an open referral | Yes | No routine use |
| Read/manage applications on own referrals | Yes | Monitor/moderate |
| Change referral assignment/status | Own referrals, per workflow | Moderation override with audit trail |
| Edit own profile and submit verification | Yes | Review and decide |
| Suspend members or moderate content | No | Yes |
| View platform reports/settings | No | Yes |

**State gate:** unverified professionals may complete their profile and submit verification, but cannot publish or apply until approved. Suspended accounts cannot use marketplace actions. Confirm whether admins can also hold a professional account.

## Referral lifecycle proposal

`draft → open → reviewing → matched → in_progress → completed`

Additional terminal states: `rejected`, `expired`, `cancelled`. Applications use their own lifecycle: `submitted → reviewing → accepted/rejected/withdrawn`. A referral becomes `matched` when its owner selects an eligible applicant. Keep the application decision separate from the referral lifecycle; record who changed a status and when.

## Firebase architecture proposal

The proposal names PostgreSQL; because the client now requests Firebase, Phase 1 proposes Firebase as an alternative and this decision should be recorded with the client before implementation.

- **Firebase Authentication:** email/password identity, email verification, and password reset.
- **Cloud Firestore:** structured application records: `users/{uid}`, `referrals/{referralId}`, `applications/{applicationId}`, `verificationSubmissions/{submissionId}`, `activityEvents/{eventId}`, and `platformConfig/{documentId}`. Store applicant and owner UIDs on records for rule checks. Keep application/referral status changes atomic using Firestore transactions or trusted server functions.
- **Cloud Storage:** license and verification documents in private per-user paths. Never expose document URLs through public referral/profile reads.
- **Cloud Functions:** privileged approval/suspension, assignment, notification hooks, and any operation that requires trusted admin authority. Admin status must come from a trusted custom claim or server-maintained role document, never a user-editable profile field.
- **Security rules:** deny by default; professionals can edit only their own permitted profile fields and records; only verified, active users can publish/apply; owners can read applications for their referrals; an applicant can read their own application; only authorized admins can read verification documents and moderate. Validate allowed fields and state transitions. Require Storage rules to check owner/admin and content limits.
- **Operational controls:** App Check, least-privilege service accounts, audit events for admin decisions, indexes for status/location/category/createdAt queries, and Emulator Suite checks before production.

Firestore is a good fit for a Firebase-first MVP with bounded document-shaped workflows and realtime status updates. If analytics, complex joins, financial reporting, or cross-market querying become central, reassess a relational store or an analytics warehouse before the data model hardens.

## Information architecture

- Workspace: Overview, Marketplace, My referrals, Applications, Deal pipeline.
- Account: My profile, Verification.
- Administration (admin-only): Overview, Professionals, Verification queue, Referrals/moderation, Applications, Reports/activity, Settings.

## UI direction

Use a calm white canvas, deep navy text, and blue gradients for the primary action and brand mark. Keep gradients restrained so statuses and data stay legible. Use pale-blue surfaces for selected navigation and labels, green for approved/successful states, and amber for pending review. Desktop uses a fixed left navigation and responsive content grid; mobile collapses navigation and stacks cards.

## Decisions to confirm at client review

1. Firebase replaces PostgreSQL for the first release.
2. Which evidence qualifies for professional verification and who approves it.
3. Referral fee meaning (percentage, amount, or negotiable), who enters it, and when it is payable.
4. Whether an agent may apply to their own referral, how many professionals can be selected, and which party may change a matched referral.
5. Expiration, cancellation, completion evidence, and dispute handling.
6. Whether the $99/month PRO plan remains in Phase 4, and which benefits it unlocks.
7. Admin staffing, moderation reasons, suspension/appeal handling, and required reports.
8. Initial service area, supported currencies/time zones, privacy policy/retention requirements, and notification channels.

## Acceptance criteria for Phase 1

- Client approves the role matrix, lifecycle, required fields, and admin capabilities.
- Client approves the screen inventory and desktop/mobile visual direction.
- Firebase is documented as the chosen backend (if confirmed), with collections, role gates, private-file handling, and rule strategy agreed before Phase 2.
- Open business decisions above are resolved or explicitly deferred with an owner and target phase.

## Prototype notes

Open `agentreferrals-phase1.html` in a browser. Navigation, basic referral search/category filtering, and the posting-form visual are interactive. Form actions are local preview behavior only; no Firebase project, credentials, database, authentication, or production data are connected.


