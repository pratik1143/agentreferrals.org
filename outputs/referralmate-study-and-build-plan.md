# AgentReferrals — ReferralMate study and build plan

Study date: 2026-09-26. Reference: https://referralmate.co/ (public site and user-authorized signed-in walkthrough). This is a product/UX study; the account password, private profile details, referral content, and affiliate link are intentionally omitted.

## Goal

Reach feature parity with ReferralMate's core agent journey, then add AgentReferrals' dashboard, verification, private documents, and clearer referral pipeline. Build an original AgentReferrals interface and content. Do not use the reference site's source code, branding, user data, or media assets.

## What the reference product does

| Area | Observed behavior | AgentReferrals target |
| --- | --- | --- |
| Public site | Landing page, preview of recent referrals, How It Works, FAQ, pricing and login | Keep our existing brand; add a safe public teaser feed with limited, nonprivate fields |
| Sign-in | Email-first flow, then password for an existing account | Keep Firebase email/Google/phone; simplify sign-in flow after core workflows are stable |
| Marketplace | Desktop split list/detail view; mobile bottom navigation; Active/Closed/Saved tabs; state, client type and sort filters | Responsive split view, URL-based referral selection, server-backed filters and pagination |
| Referral detail | Lead vs agent referral, location, buyer/seller, price, fee, application count, description and preferences | Separate public opportunity from private client details; show source/type clearly |
| Actions | Apply, Save, Invite a Friend, Apply as PRO | Apply and Save in core release; invitations and paid priority in later phase |
| Post referral | Buyer/Seller/Renter; lender need; city autocomplete; fixed/range price; fee; description; agent preferences | Create/edit/publish/pause/expire with validation, preview and server-stored drafts |
| Apply | Fit message (up to 5,000 chars), managing broker name and e-sign email; partner leads show an extra explanation | Application with broker contact, eligibility checks, duplicate prevention and explicit sharing consent |
| My Applications | Applied, Viewed, Selected, Agreement Pending, Agreement Executed, Closed | Same lifecycle, plus clear withdraw/rejection outcomes and activity history |
| My Referrals | Posted, Applications Received, Agent Selected, Agreement Pending, Agreement Executed; CSV export | Owner workspace with applicant review, selection, status and export |
| Profile/settings | Profile tags, contact/bio, brokerage and license; business card; email/push preferences; PRO, affiliate, appearance and developer integrations | Profile/verification in core; business card and monetization later |
| Monetization | Free tier and PRO; pricing page lists two free applications/month and paid priority features | Confirm business rules with client before implementing quotas, billing or priority ranking |

Observed routes: `/get-started`, `/all-referrals`, `/applications`, `/my-referrals`, `/apply/:id`, `/settings`, `/settings/profile`, `/settings/business-card`, `/settings/notifications`, `/settings/subscription`, `/settings/affiliate`, `/settings/integrations`. I viewed forms and pages without posting, applying, signing, purchasing, or changing settings.

## Current project gap

- React/Vite landing page and Firebase Authentication are present.
- Firestore profile creation exists. Current rules allow only approved professionals to read open referrals; referral writes and application/agreement collections are denied.
- The current `ProfessionalPanel.jsx` is a visual prototype with seeded referrals, applicants, pipeline deals, agreements, notifications and localStorage state. Publishing, applying and signing currently update browser-only state and display success notices. These are **not** real cross-user operations and must be replaced before release.
- Profile editing, verification review, private document storage, paid entitlements, notifications and trusted admin actions have no production backend.
- Role architecture should use trusted Firebase custom claims for ADMIN/SUPER_ADMIN and object ownership checks. Referring and receiving remain contextual relationships of one PROFESSIONAL role.

## Recommended build sequence

### 0. Stabilize the prototype

1. Split the large `ProfessionalPanel.jsx` into routes/components and a data layer; keep the current design only where it aids the core journey.
2. Remove seeded production-looking metrics and client data from signed-in screens. Label sample data clearly in a dedicated demo mode.
3. Remove fake success messages for publish, apply and sign. Show an unavailable state until the matching server action is live.
4. Add loading/error/empty states and make URL navigation survive reloads.

**Done when:** every visible action either persists through a trusted backend or clearly states that it is unavailable.

### 1. Identity, profiles and verification

1. Create `professionalProfiles/{uid}` with brokerage, license jurisdictions, specialties, markets, languages, bio and profile photo metadata.
2. Add validated self-service edits for ordinary profile fields. Keep role, verification decision and account status server-controlled.
3. Store license/identity files in private Cloud Storage paths; build submission and reviewer decision workflow with audit events.
4. Add account-state gates: pending/approved/suspended. Decide whether pending users may browse public opportunities while posting/applying remains blocked.

**Done when:** a professional can complete a profile and submit verification; a trusted reviewer can approve/request changes/reject, and rules enforce the result.

### 2. Referral marketplace and posting

1. Define canonical referral fields: creator UID/profile ID, `kind` (`REFERRAL` or `PARTNER_LEAD` if that product is adopted), client type, location, property type, min/max value in cents, fee terms, description, preferences, status and expiry.
2. Separate `referrals/{id}` public opportunity fields from `referralPrivate/{id}` client identity/contact data. Never put private client details in the marketplace document or logs.
3. Build server-validated create, draft, edit, publish, pause, resume, close and expire actions with ownership checks.
4. Build filters, sort and cursor pagination using Firestore indexes or a search service if full-text/geographic search needs exceed Firestore queries.
5. Implement user-scoped saved referrals.

**Done when:** one verified user can publish and another eligible user can find the same referral; owner-only actions and privacy hold under direct URL access.

### 3. Applications and selection

1. Create application records with applicant ID, referral ID, fit message, broker contact and status.
2. Enforce server-side checks: signed in, approved, referral published/unexpired, not owner, not duplicate, and any eventual plan quota.
3. Give owners an applicant list and profile preview; allow shortlist/reject/select with one selected recipient unless product rules allow otherwise.
4. Give applicants a status view and withdraw action; send in-app/email notifications from backend events.
5. Audit every decision and protect applicant/broker details by participation.

**Done when:** two accounts can complete post → apply → review → select without browser-local state or access leakage.

### 4. Agreements and referral pipeline

1. Generate an agreement draft from selected parties and fee terms. Review legal wording with the client before launch.
2. Integrate an e-sign provider or a legally reviewed in-house signing workflow; record signer identity, timestamps, document version and immutable audit trail.
3. Advance through Selected → Agreement Pending → Signed → Referred → In Progress → Closing → Completed/Cancelled. Make transitions explicit and permissioned.
4. Add private handoff, status updates, reminders and agreement download for parties.

**Done when:** both parties can review/sign the correct agreement and track the same deal status securely.

### 5. Growth and differentiating features

- Original AgentReferrals dashboard showing actual pending actions, available opportunities and active deals.
- Brokerage membership and brokerage-scoped reporting without adding permanent referring/receiving roles.
- Virtual business card and shareable profile.
- Notification preferences (email and in-app first; push/SMS later).
- PRO subscription, application quotas, priority ranking and AI assistance only after pricing/eligibility rules are approved.
- Affiliate tracking, Stripe payouts, API/webhooks and live Q&A as separate later modules with abuse controls.

## Backend and data model

Core collections: `users`, `professionalProfiles`, `verificationSubmissions`, `referrals`, `referralPrivate`, `referralApplications`, `savedReferrals`, `agreements`, `referralActivity`, `notifications`, `adminAuditLog`. Add `brokerages` and `brokerageMemberships` when brokerage workspace begins; add `subscriptions/entitlements` and `affiliateAttributions` only with their matching product phases.

Use Firebase Authentication for identity, Firestore for shared records, private Cloud Storage for documents, and trusted Cloud Functions/Admin SDK for privileged decisions and multi-record state transitions. Firestore Security Rules enforce read/write access at each object. Email/webhook work runs server-side and is idempotent. Keep IDs and amounts typed consistently (UIDs, cents, numeric percentages, server timestamps).

## Security and product decisions before implementation

- Who may browse before verification, and what fields are public?
- Do we need separate `PARTNER_LEAD` inventory, and what disclosure/consent differs from an agent referral?
- Can one referral have multiple selected professionals? What statuses can be reversed?
- Which fee format is allowed: percentage, fixed amount, first-month rent, or custom terms?
- Which broker is an agreement party, and which e-sign provider/template governs signatures?
- Are free application limits and PRO pricing the same as the reference product or different for AgentReferrals?
- Which additional features should be prioritized beyond the core flow?

The reference product's current pricing/feature rules are observations, not AgentReferrals business decisions. Its public pricing and FAQ should be rechecked when monetization work starts because these details can change.
