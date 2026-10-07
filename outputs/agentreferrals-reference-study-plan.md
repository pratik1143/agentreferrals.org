# AgentReferrals.org — Reference study & build plan

## Study summary

Reference studied: [ReferralMate](https://referralmate.co/), including its [public homepage](https://referralmate.co/), how-it-works content, [pricing](https://referralmate.co/pricing), and [FAQ](https://referralmate.co/faq) pages, and the signed-in marketplace, a referral detail, the post-referral form, Applications, My Referrals, Settings, and the professional profile screen.

The reference demonstrates a member workflow that expands beyond the original project proposal: public discovery and marketing; a filtered referral feed; lead/referral details; applications; saved referrals; a post form; profile and professional details; PRO/partner options; and account settings. Its current site separates the public marketing surface from a bottom-tab member workspace. Proposal flows overlap on the essential marketplace journey, while provider choices, PRO entitlements, and later admin controls need to be confirmed with the client.

This plan uses the reference for workflow study. The product should have its own UI, text, code, and brand expression. Keep the requested white/blue visual direction and use restrained blue gradients for primary actions.

## Main workflows observed

1. A visitor reads public information, then signs up or logs in.
2. A professional completes a profile with biography, markets, brokerage, license, experience, and areas of specialization.
3. A member browses opportunities and can narrow them by status, state, client type, or recency.
4. A referral card shows location, client type, price or price range, fee, short description, application count, and recency.
5. Opening a referral exposes the fuller description and actions to apply, save, invite another person, or apply through a PRO path.
6. A member follows their submitted applications and referrals they posted in separate workspaces.
7. Account settings surface profile, virtual business card, notifications, PRO, affiliate, appearance, and integrations.
8. Public help pages explain the product, process, and pricing.

The inspected post form included buyer/seller/renter, an optional mortgage-lender need, city, fixed or ranged price, referral fee, description, and agent preferences. Do not collect real client identities or exact addresses in public referral documents.

## Product we should build

A professional B2B real-estate referral marketplace that supports the proposal's core lifecycle:

`verified professional → post referral → discover → apply → review → select → manage → complete`

Build the core independently with comparable capabilities, rather than reproducing the reference site's code, exact copy, visual assets, or distinctive layout. The AgentReferrals.org sign-in/workspace concept in this codebase uses the requested white/blue direction and new brand identity.

## Phase-by-phase plan

| Phase | Build focus | Concrete deliverables |
|---|---|---|
| 1 · Discovery, UX/UI, architecture | Confirm role model and lifecycle; establish screen inventory; approve visual language; define data and access model | Journey maps, wireframes/prototype, responsive states, Firestore schema/index plan, role/access matrix, acceptance criteria |
| 2 · Authentication, profiles, verification | Email/password, Google and phone sign-in; password reset and email verification; profile; brokerage/license details; private document submission; review status | Auth flows; profile editor; secure Storage paths/rules; admin review states; account suspension gate |
| 3 · Marketplace and posting | Create/edit/manage opportunities; marketplace cards and details; search/filter; state/city; buyer/seller/renter; price and referral fee; save/invite; expiry and statuses | Firestore-backed feed and detail; referral composer; saved items; owner dashboard; pagination and indexes |
| 4 · Applications, matching, agreements, PRO | Application capture; applicants list/profile preview; accept/reject; assignment; deal pipeline; agreement status; notifications; optional PRO gate | Application and assignment workflow; activity history; email/in-app notifications; $99/month membership integration only after entitlement/pricing confirmation |
| 5 · Admin, QA, launch | User/verification moderation; referral/app monitoring; reports/audit; settings; device/accessibility/performance/security review; deployment | Admin workspace, tested rules and auth provider setup, production configuration, deployment and launch checklist |

The existing proposal's schedule and budget assigns two weeks/$1,200 to Phase 1; the full proposal covers 12 weeks/$8,000. Reference capabilities such as AI application assistance, an agreement generator, integrated referral tracking, virtual business card, affiliate program, or coaching are extras relative to the proposal's stated core journey. Estimate any of those separately unless the client explicitly includes them.

## Brand identity

The company brand is **AgentReferrals.org**. The custom vector mark uses a geometric A shaped from connected referral paths with an outward arrow, in a sapphire-to-blue gradient with crisp white network nodes. Logo assets: `public/agentreferrals-mark.svg` (icon) and `public/agentreferrals-logo.svg` (horizontal lockup).

## Page map for our original app

- Public: home, how it works, FAQ, pricing, help/support.
- Member workspace: Overview, Marketplace, Referral details, Post referral, My referrals, Applications, Deal pipeline, Saved referrals.
- Account: Professional profile, Verification, Notifications, Settings.
- Super admin: Overview, Professionals/verification, Referrals/moderation, Applications, Reports/activity, Support, Settings.

## Firebase implementation plan

### Firebase Authentication

- Email/password: create account, sign in, reset password, verify email.
- Google: popup on desktop and redirect on mobile devices.
- Phone: SMS sign-in with reCAPTCHA verification; accept international-format numbers.
- On first sign-in, create a private `users/{uid}` profile with an unprivileged role and pending verification state.
- Enforce role and verification changes only via a trusted admin/server workflow. The client can never grant itself admin, verified, or PRO status.
- Configure authorized domains and test-number/SMS settings in the project after project access is available.

### Firestore collections and data boundaries

| Path | Purpose | Suggested access |
|---|---|---|
| `users/{uid}` | Private account details, contact information, role/status | Owner read/update safe fields; admins via trusted role |
| `publicProfiles/{uid}` | Opt-in business profile visible to marketplace members | Authenticated reads; owner safe-field edits; never store private email/phone here |
| `referrals/{referralId}` | Discoverable card fields: owner UID, client type, coarse location, price range, fee, status, created/expiry times | Active professionals read open posts; verified owners create/edit their own |
| `referralPrivate/{referralId}` | Full client context and sensitive details, when truly needed | Owner and selected recipient only; admin access audited |
| `applications/{applicationId}` | Applicant UID, referral ID, message, status, timestamps | Applicant sees own; referral owner sees submissions for their post |
| `savedReferrals/{uid}/items/{referralId}` | Per-member saved items | UID owner only |
| `verificationSubmissions/{uid}` | License metadata and review decision | Member sees own status; admin-only decision/document read |
| `userNotifications/{uid}/items/{id}` | Member-visible notices | UID owner only; trusted writers |
| `activityEvents/{eventId}` | Workflow/admin audit history | Involved parties see allowed event subset; admins audit all |
| `membershipEntitlements/{uid}` | Server-confirmed subscription and benefits, if approved | User may read own; trusted server writes only |
| `adminAuditLog/{eventId}` | Moderation/privileged actions | Admin service only |

Keep private profile/contact fields separate from public professional information. Store license files in a private Cloud Storage path; Firestore rules alone do not protect Storage objects.

### Access and query plan

- Use Firebase Auth UID as the immutable document owner key.
- Require verified, active professionals for referral posting and applying. Keep registration open only to profile setup until the verification gate is complete.
- Never trust a client-sent `role`, `verificationStatus`, `isAdmin`, or subscription flag.
- Validate allowed fields, data types, lengths, price/fee ranges, immutable timestamps, ownership, and status transitions in rules or trusted functions.
- Keep public-feed documents small and free of client contact/identity details. Read full referral details only after checking the relationship and workflow status.
- Add Firestore indexes for feed queries such as `status + createdAt`, then category/clientType/state + status + createdAt as filters are finalized. Keep query filters compatible with security-rule checks.
- Use transactions/callable functions for application selection and assignment so two applicants cannot both be selected by racing clients.
- Use App Check, least-privilege service accounts, rate controls on expensive actions, and admin audit records before production.

## Current workspace state

- `src/` now contains the AgentReferrals.org React/Vite app shell with Email/password, Google popup/redirect, phone/SMS with reCAPTCHA, Auth state handling, private Firestore profile creation, and an open-referrals read query.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc`, and `.env.example` give a project-targeted local setup starting point.
- The Firebase Web app config has now been supplied and stored in the ignored local `.env.local`; the provided app ID indicates a Web app is already registered in project `agent-referrals-ec588`. The project ID is also set as the Firebase CLI default target. The Firebase CLI account currently lacks access: the project is not in its accessible project list and Firestore API access returned permission denied. No Auth providers, Firestore database, rules, or indexes could yet be checked or changed remotely.
- A backend Admin SDK service-account key is not needed in the browser. The provided Admin SDK pattern is server-only; never place a service-account JSON/key in `.env` exposed to Vite, client source, or public hosting.

## Decisions needed before implementation locks

1. Confirm final marketplace geography (the reference currently emphasizes U.S. state markets); decide supported currencies, states, and city search behavior.
2. Confirm profile verification evidence and reviewer, plus what the public profile displays.
3. Confirm whether referral types include only real-estate transactions or also rentals/lenders and other categories.
4. Define referral fee semantics, closing/expiry rules, cancellation, and who may edit an opportunity after applications arrive.
5. Define application limits, selection count, rejection/withdrawal behavior, client-data disclosure point, and dispute process.
6. Confirm whether PRO is required, its benefits, and billing vendor/timing. The proposal describes a $99/month workflow in Phase 4; the reference's tier contents are evidence for discussion, not an automatic scope change.
7. Confirm admin authority, moderation reasons, suspension appeal path, audit and report requirements.
8. Confirm deployment/domain ownership, privacy/retention policy, and notification channels.

## Review checkpoint

Approve the lifecycle, role gates, public/private data boundary, page map, verification process, and PRO scope before treating the Firestore schema or rules as final. Then gain CLI access to the intended Firebase project, register the web app, choose/confirm its Firestore instance and edition, enable the three auth providers, set authorized domains, and validate/deploy rules and indexes.



