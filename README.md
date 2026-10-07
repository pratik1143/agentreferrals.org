# AgentReferrals.org app

Firebase-backed React/Vite codebase for the referral marketplace. The Firebase Web SDK (client app config) initializes Authentication and Cloud Firestore. Never put a service-account private key in this frontend. The supplied measurement ID is available to add Analytics later; Analytics is not initialized in this build.

## Local setup

1. Install dependencies with `npm install`.
2. `.env.local` is prefilled from the Firebase Web app config you supplied. It is ignored by Git; keep it local.
3. Start the app with `npm run dev`.

Email/password (including sign-up and password reset), Google popup/redirect, phone/SMS with reCAPTCHA, Auth state handling, and private Firestore user-profile creation are wired in. The workspace reads open referrals using a status + createdAt query.

## Firebase project setup

The existing Web app `1:875746863348:web:44c21c7cf1dd6efcb856a1` and Standard `(default)` Firestore database in `agent-referrals-ec588` are in use; no duplicate app or database was created. Email/Password and Google providers were enabled through Firebase CLI. Phone sign-in was already enabled in the Firebase Console, and its SMS region policy now allows the United States only. Add the production domain to Authentication's authorized domains after DNS/Hosting are configured.

Prototype Firestore rules and the referral query index are deployed. The rules keep user profiles owner-only, deny writes to the marketplace in this phase, and allow approved professionals to read open referrals. Treat them as a prototype and review/harden them before launch. The pasted Node Admin SDK example is for trusted server code only; this app uses the Web SDK and does not need an Admin service account.

## Current feature boundary

Auth and initial profile persistence are implemented. Marketplace writing, applications, verification upload/admin approval, PRO subscriptions, referral agreements and production notifications need their later proposal phases. The first logged-in screen is an original concept inspired by the reference workflows, with no reference-site code or private data copied.





## Role and authorization model

The MVP keeps platform roles deliberately small: `PROFESSIONAL`, `ADMIN`, and `SUPER_ADMIN`. A professional may create referrals and apply to other professionals' referrals; `referring`, `receiving`, `applicant`, and `owner` describe a user's relationship to a particular referral or application, not a permanent account role.

`BROKERAGE_ADMIN` and `VERIFICATION_REVIEWER` are reserved scoped roles for later organization and verification workflows. They are not active platform roles in this MVP. Brokerage access should eventually live on a brokerage membership record, while verification-specific access should be limited to the relevant review workflow.

Authorization must check authentication, the trusted platform role where required, and ownership/participation for the specific record. Never grant a user privileged access based on a role value they can write themselves. The prototype's Firestore rules only let a user create a `PROFESSIONAL` profile and prevent changes to role/status; privileged roles are intended to come from Firebase custom claims assigned by a trusted Admin SDK service. Referral writes, applications, agreements, and admin collections remain denied until their server-side workflows and object-level rules are implemented.

Legacy prototype profiles may still contain the lowercase value `professional`; marketplace authorization accepts that value during migration. New profiles use `PROFESSIONAL`.
