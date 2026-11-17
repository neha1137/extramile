# Extra Miler Google Drive backend

This backend connects **one organization Google account** to the Extra Miler app. Extra Milers and evaluators never connect their own Google Drive.

## What changed

- Google Drive authorization is done once for the organization account.
- The resulting OAuth refresh token is kept server-side (`GOOGLE_REFRESH_TOKEN`) and is never sent to the browser.
- The frontend asks the backend to authorize the member/task and create a Google Drive folder structure plus a short-lived resumable upload session.
- The browser then uploads the file directly to Google Drive using that session. The 100 MB file does not pass through Vercel or the Express backend.
- The backend stores a server-only session record and verifies the caller, generated filename, expected byte count, and destination folder before the frontend creates the Firestore submission record.
- Firebase ID tokens are required for upload initiation/completion, so a random visitor cannot impersonate an Extra Miler.

Google Drive recommends resumable uploads for larger files and interrupted networks: https://developers.google.com/workspace/drive/api/guides/manage-uploads

## Local setup

1. Copy `.env.example` to `.env`.
2. Put your Google OAuth client ID and secret in `.env`.
3. Register this redirect URI in Google Cloud:

   `http://localhost:4000/api/google/callback`

4. Put your Firebase Admin service-account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON` as one line.
5. Run `npm install` in this folder.
6. Run `npm run connect-drive`.
7. A browser opens/you visit `http://localhost:4000/api/google/auth` and authorize the **one organization Google account** that owns the submission Drive.
8. The script saves the refresh token into `server/.env`.
9. Run `npm start`.

Do NOT commit `.env`, refresh tokens, or the Firebase service-account JSON.

## Production on Vercel

Set these Vercel environment variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` (optional)
- `MAX_FILE_SIZE_BYTES` (optional; default 100 MB)

The production frontend uses `/api/...` on the same Vercel project. No student needs Google Drive access.

## Drive folder structure

`Extra Miler Submissions/<studentId>_<studentName>/<taskId>_<taskTitle>/<studentId>_<studentName>_<team>_<taskId>_<taskTitle>.<ext>`

The root folder is created automatically if `GOOGLE_DRIVE_ROOT_FOLDER_ID` is not supplied. With the `drive.file` scope, this is the safest approach because the app can manage files/folders it created.


## Password-reset email configuration
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, and `PASSWORD_RESET_CONTINUE_URL` in `.env`. For Gmail, use an App Password. The Firestore user document must have `userId`, `verifiedEmail` (or `email`) and `emailVerified: true` (or `verifiedEmailVerified: true`). Passwords are updated by Firebase Auth itself; the backend only emails a Firebase-generated action link. For Vercel, set the same variables in Project → Settings → Environment Variables.

## Google Drive setup without repeated prompts
The admin OAuth connection is a one-time setup and its refresh token is persisted in Firestore. Alternatively, set `GOOGLE_REFRESH_TOKEN` and optionally `GOOGLE_DRIVE_ROOT_FOLDER_ID` in `.env`. Keep all credentials server-side.


### Admin-created member accounts

Set `EXTRA_MILER_INITIAL_PASSWORD` in the backend environment to the shared starter password you will give new members separately. Keep it server-side only; never add it to the frontend `.env` or commit it to source control. The admin dashboard can then create a member by entering their email, name, and role. Firebase Authentication account creation and the matching Firestore profile are handled by the backend. Member IDs are generated automatically (`EM001`, `M001`, `EV001`, `AD001`, incrementing within each role). Members can use **Change password** on the login page after signing in with their starter password.
