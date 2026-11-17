# Extra Miler

Firebase Auth + Firestore for the Extra Miler platform, with Google Drive used for submission files.

## Quick start

### React app
```bash
npm install
npm run dev
```

### 1) Configure Firebase and backend secrets
```bash
cp .env.example .env
cd server
cp .env.example .env
npm install
```
Fill `server/.env` using `server/README.md`. Keep secrets out of the frontend `.env` and never commit them.

### 2) Start the backend and frontend (two terminals)
Terminal A:
```bash
cd server && npm run dev
```
Terminal B (project root):
```bash
npm install
npm run dev
```
Open `http://localhost:5173`. Complete `docs/QUICK_FIREBASE_SETUP.md` before testing submissions.

## Important
- Firebase Storage is intentionally not used.
- Do not commit `.env`, `server/.env`, Firebase service-account JSON, OAuth client secrets, or refresh tokens.
- Members sign in using their real email address and password. The app uses their assigned Extra Mile ID in profiles and submission filenames.


## Google Drive submission setup

Google Drive uses one organization-owned account. You have two setup options:

- **Recommended for a quick demo:** configure Google OAuth and connect the Drive once from the Admin → Google Drive page. The refresh token is saved in Firestore and students never see an OAuth prompt.
- **Environment-only:** set `GOOGLE_REFRESH_TOKEN` and `GOOGLE_DRIVE_ROOT_FOLDER_ID` in `server/.env` (or hosting environment variables). Then no interactive admin connection is needed.

Submissions are organized as `Extra Miler Submissions / Team / Member ID_Name / Task ID_Title / file`. Filenames include member ID, member name, team and task. Uploads go to Drive first; the Drive file ID/link is then saved to Firestore.

The Drive integration is intentionally a local-development MVP. Before public deployment, verify Firebase ID tokens on the backend and enforce server-side ownership/role checks.

## Vercel + Google Drive deployment

The production app uses Firebase Auth/Firestore plus a Vercel Node API. Extra Milers do **not** connect Google Drive. One organization Google account is authorized once; its refresh token is stored only in Vercel environment variables.

### Important
- Never commit `.env`, `server/.env`, refresh tokens, Firebase service-account JSON, or OAuth client secrets.
- The production upload path uses Google Drive resumable uploads. The authenticated Vercel endpoint checks the member and task, creates a short-lived Google upload session, and records a server-only verification record. The browser sends file bytes directly to Google's upload session; the 100 MB file never passes through a Vercel Function.
- Completion is verified server-side against the caller's upload session, expected file size, generated filename, and destination folder. Client reads/writes to `driveUploadSessions` are denied by Firestore rules.
- Before deploying, set `GOOGLE_REFRESH_TOKEN` and `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel. Set `MAX_FILE_SIZE_BYTES=104857600` if you want to explicitly pin the 100 MB limit.

See `server/README.md` for the one-time Google Drive connection flow.


## Final integrations

### Unstop
Admin users can open **Opportunities**, paste a public Unstop opportunity URL, fetch public page details, review/edit them, and publish the opportunity to Firestore. Students, mentors, and evaluators only see published opportunities. This uses public-page import rather than an undocumented Unstop API.

### Mentorship
A student may send multiple requests to the same mentor. An exact duplicate pending message is blocked; a different message creates a new request and a new real-time mentor notification.

### People
Evaluator and Admin profiles are hidden from the community People directory.

## Forgot password
The login screen now has **Forgot password?**. The backend looks up the user's profile and emails a Firebase password-reset action link to `verifiedEmail` (or `email` only when `emailVerified: true` / `verifiedEmailVerified: true`). Add SMTP settings in `server/.env`. Since legacy Firebase sign-in uses an internal `<userId>@extramiler.app` account email, the backend sends the generated Firebase reset link to the verified contact email. Make sure each user's Firestore profile contains a verified recovery email and the verification flag.

For Gmail SMTP, enable 2-Step Verification on the sender account and use a Google App Password, not your regular Gmail password. Add your app's deployed URL to Firebase Authentication → Settings → Authorized domains.

## Admin: create member accounts

1. In Vercel → Project → Settings → Environment Variables, add `EXTRA_MILER_INITIAL_PASSWORD` with the shared starter password you plan to give new members manually. Add it for the Production environment (and Preview if needed). Do not prefix it with `VITE_`; it must remain server-side.
2. Confirm `FIREBASE_SERVICE_ACCOUNT_JSON` is configured in Vercel and its service account has Firebase Authentication and Firestore admin access.
3. Deploy the updated project. Sign in with your existing Admin account and open the Admin dashboard.
4. Under **Create a member account**, enter the member's real email, full name and role. The system creates their Firebase Authentication account and Firestore profile and generates a unique ID automatically (`EM001`, `M001`, `EV001`, or `AD001`, incrementing per role).
5. Share the configured starter password with the member separately. They can sign in using their email and starter password, then choose **Change password** on the login page. They can also use **Forgot password?** for recovery.

The API checks the caller's Firebase ID token and requires an existing Admin role before creating accounts. Existing role-assignment API behavior remains available; the admin dashboard's primary flow now creates accounts directly. Evaluator and Admin profiles remain excluded from the public People page.
