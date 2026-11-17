# Extra Miler — quick Firebase setup

The app is wired for Firebase Authentication and Firestore. Submission files are uploaded to Google Drive through the included Node server; Firebase Storage is intentionally not used.

## 1. Environment
Copy `.env.example` to `.env` and paste the Firebase Web App values.
Do not commit `.env`.

## 2. Authentication
Firebase Console → Authentication → Sign-in method → Email/Password → Enable.

Create accounts using the internal email format:
- EM001 → `em001@extramiler.app`
- EM002 → `em002@extramiler.app`
- EV001 → `ev001@extramiler.app`
- M001 → `m001@extramiler.app`

The app users type only the ID.

## 3. Firestore user profile
Create `users/{Firebase Auth UID}`. Example:

```text
userId: EM001
name: Neha
email: em001@extramiler.app
role: extra-miler
active: true
department: Computer Science
year: 2nd Year
bio: ...
skills: ["React", "Python"]
interests: ["Startups"]
xp: 0
level: 1
```

Valid roles: `extra-miler`, `mentor`, `evaluator`, `admin`.

## 4. Add a task
Create `tasks/{taskId}` with:

```text
title: Define your problem
chapter: 01 · FOUNDATION
description: Turn your idea into a clear problem statement.
deadline: Timestamp
points: 100
maxMarks: 100
submissionType: file
active: true
order: 1
createdBy: admin UID
createdAt: Timestamp
```

Optional fields: `steps` (array of strings), `rubric` (array of strings or `{name, weight}` objects).

## 5. Submission files — Google Drive (no Firebase Storage)
Firebase Storage is intentionally **not used** in this version, so you can keep the Firebase project on Spark. Submission files go to a Google Drive folder owned by the program account.

### Drive structure
```text
Extra Miler Submissions/
  EM001_Neha/
    task1_Define_your_problem/
      EM001_Neha_TeamAlpha_task1_Define_your_problem.pptx
```
The app builds the filename automatically from the student's User ID, name, team name and task. Students do not manually type the filename.

### One-time Google Drive backend setup
The project includes a small Node server in `server/`. It uses Firebase Admin to verify the logged-in student and Google Drive OAuth to upload into the program Google Drive. Firebase billing is **not** required for this.

1. Create a Google Drive folder for submissions using the program Google account. Copy its folder ID from the URL.
2. In Google Cloud Console, create/choose a project, enable the **Google Drive API**, and create an OAuth client. Use `http://localhost:8787/oauth2callback` as the local redirect URI if the client type allows it.
3. Copy `server/.env.example` to `server/.env`.
4. Add the Google OAuth client ID/secret and the Drive parent folder ID.
5. In Firebase Console → Project settings → Service accounts, generate a private key and put the JSON on one line in `FIREBASE_SERVICE_ACCOUNT_JSON`. **Never commit this file.**
6. Run the one-time OAuth helper from `server/` to authorize the program Google account and obtain a refresh token:
```bash
node scripts/get-google-refresh-token.mjs
```
7. Put the returned refresh token into `server/.env`.
8. Start the upload server in one terminal:
```bash
cd server
npm install
npm run dev
```
9. Start the React app in another terminal:
```bash
npm install
npm run dev
```

The React app proxies `/api/drive/*` to the local Drive server. The server creates the student/task folders and uploads the file.

### Evaluator access
The uploaded Drive files are owned by the program Google account. Give the evaluator Google accounts access to the parent submissions folder (or the relevant student folders) in Drive. The evaluator opens the saved `driveUrl` from the evaluation screen.

### Team name
Students can save their team name once from **Profile → Edit profile**. Every future submission automatically includes that team name in the Drive filename and Firestore metadata.

## 6. Firestore rules
Publish `firestore.rules` from this project.
Never use `allow read, write: if true`.

## 7. Evaluator
Create an Auth account such as `ev001@extramiler.app`, then create its Firestore profile with:
`userId: EV001` and `role: evaluator`.

Evaluator flow:
1. Sign in as EV001.
2. Open Submissions.
3. Open a submitted file.
4. Enter marks and feedback.
5. Save evaluation.

The save updates the submission and adjusts the student's XP transactionally. XP is based on the task's points and the percentage score.

## 8. First demo flow
EM001 login → My Tasks → open a Firestore task → upload PDF/PPT/etc. → EV001 login → Submissions → grade → EM001 leaderboard.

## Current MVP behavior
- Extra Miler dashboard and My Tasks are now database-driven. Dashboard is a summary; My Tasks is the full task list.
- New users start with `xp: 0` and `level: 1` (unless changed by an evaluator/admin action).
- Task status is derived from Firestore submissions: `Not started`, `Submitted`, or `Completed` after evaluation. No fake 60% progress is used.
- Profile form refreshes from Firestore and saves editable profile fields.
- People reads active users from `users`, so newly created active profiles appear there.
- Leaderboard reads active Extra Miler users and their Firestore `xp`; new users therefore start at 0.
- Notifications are database-driven. Evaluating a submission creates a notification for that Extra Miler. The Notifications page listens for new notifications in real time.
- Opportunities remain unchanged for now and can later be connected to an external opportunity source/API.

## Publish updated rules
After downloading this version, publish `firestore.rules` in Firebase Console. Firebase Storage rules are no longer part of the submission flow. The Firestore rules include a `notifications` collection used by the real-time notification flow.


## V4 task-loading fix

The app now loads tasks, submissions, and leaderboard data independently and subscribes to the relevant Firestore collections in real time. A failure in leaderboard/submission loading can no longer make the task list appear empty.

The Firestore `users` rule also permits signed-in users to read active profiles. This is required for the People and Leaderboard pages, both of which query active users. Publish the included `firestore.rules` after installing v4.

If a Firestore listener fails, the Dashboard and Tasks page now show the actual Firebase error instead of silently displaying an empty state.


### Current mockup build note
Google Drive upload is intentionally disabled in this test build. Task submissions record file metadata in Firestore only, allowing evaluator testing without a Drive account.


## Mentorship requests

Mentorship requests use the `mentorshipRequests` collection.

For a mentor to appear in an Extra Miler's profile, their `users/{uid}` document must have:
`role: "mentor"`, `active: true`, and `acceptingMentorshipRequests: true`.

The mentor can turn this on from **My Profile → Edit profile → Let Extra Milers request your guidance → Open to requests → Save profile**.

Publish `firestore.rules` after installing this version so the mentorship request permissions are active.
