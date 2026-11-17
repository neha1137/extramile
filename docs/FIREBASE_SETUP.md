# Extra Mile — Firebase setup (do this after unzipping)

This project is now wired for:

- Firebase Authentication — User ID + password
- Firestore — profiles, tasks, submissions, roles, leaderboard data
- Firebase Storage — task file uploads
- Firestore/Storage rules — role-based access

## 1. Install the new dependency

From the project folder:

```bash
npm install
```

If npm reports that Firebase is missing, run:

```bash
npm install firebase
```

## 2. Create the Firebase project

1. Open Firebase Console.
2. Create a project named `Extra Mile` (or any name you like).
3. You do not need Google Analytics for this first setup.

## 3. Register the web app

Inside your Firebase project:

1. Open Project settings.
2. Under Your apps, choose the Web (`</>`) app.
3. Register it as `extra-mile-web`.
4. Firebase will show a configuration object.

Copy the values into a new `.env` file in this project's root.

Start from `.env.example`:

```bash
cp .env.example .env
```

Then fill:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Do not commit `.env` to GitHub.

## 4. Enable Email/Password authentication

Firebase Console → Authentication → Sign-in method → Email/Password → Enable.

Important: users do NOT need to type an email in the Extra Mile UI.

The app maps:

- `EM001` → `em001@extramiler.app`
- `M001` → `m001@extramiler.app`
- `EV001` → `ev001@extramiler.app`

These are Firebase login identifiers behind the scenes. Users only see/use their Extra Mile ID.

## 5. Create Firestore

Firebase Console → Firestore Database → Create database.

Use the normal production/locked option if Firebase asks.

After creation, open the Rules tab and paste the contents of this project's `firestore.rules` file.

Publish the rules.

## 6. Create Storage

Firebase Console → Storage → Get started.

Then open Storage → Rules and paste this project's `storage.rules` file.

Publish the rules.

## 7. Create the first accounts

For the first version, create accounts manually in Firebase Console.

Authentication → Users → Add user.

For an Extra Miler with ID `EM001`:

- Email: `em001@extramiler.app`
- Password: choose a temporary password

For a reviewer:

- Email: `ev001@extramiler.app`
- Password: choose a temporary password

For a mentor:

- Email: `m001@extramiler.app`
- Password: choose a temporary password

The users do not need an actual mailbox at `extramiler.app`; this address is only the internal Firebase Auth identifier.

## 8. Create each user's Firestore profile

Firestore → Data → Start collection → `users`.

The document ID MUST be the Firebase Authentication UID for that person.

Copy the UID from Authentication → Users.

Example document for EM001:

```json
{
  "userId": "EM001",
  "name": "Student Name",
  "email": "em001@extramiler.app",
  "role": "extra-miler",
  "department": "Computer Science",
  "year": "2nd Year",
  "bio": "Building useful things.",
  "skills": ["Product", "Research"],
  "interests": ["Technology", "Startups"],
  "startupType": "Technology",
  "active": true,
  "xp": 0,
  "createdAt": "use Firestore timestamp",
  "updatedAt": "use Firestore timestamp"
}
```

Evaluator:

```json
{
  "userId": "EV001",
  "name": "Evaluator Name",
  "email": "ev001@extramiler.app",
  "role": "evaluator",
  "active": true,
  "skills": ["Evaluation", "Strategy"],
  "xp": 0
}
```

Mentor:

```json
{
  "userId": "M001",
  "name": "Mentor Name",
  "email": "m001@extramiler.app",
  "role": "mentor",
  "active": true,
  "skills": ["Product", "Growth"],
  "xp": 0
}
```

Admin:

```json
{
  "userId": "ADMIN001",
  "name": "Extra Mile Admin",
  "email": "admin001@extramiler.app",
  "role": "admin",
  "active": true,
  "skills": [],
  "xp": 0
}
```

### Important security note

Do NOT put passwords in Firestore. Firebase Authentication stores/handles passwords. Firestore stores the profile, role and permissions-related data.

## 9. Add the first task

Create collection `tasks`.

Example document ID: `task-1`

```json
{
  "title": "Define your problem",
  "chapter": "01 · FOUNDATION",
  "description": "Turn the idea in your head into a clear problem statement.",
  "steps": [
    "Write the problem in one sentence.",
    "Identify who experiences it.",
    "Add evidence that the problem is real."
  ],
  "deadline": "Use a Firestore timestamp",
  "points": 100,
  "order": 1,
  "active": true,
  "submissionType": "file",
  "rubric": [
    { "name": "Clarity", "weight": 25 },
    { "name": "Evidence", "weight": 25 },
    { "name": "Depth", "weight": 25 },
    { "name": "Reflection", "weight": 25 }
  ]
}
```

Repeat for each mission.

## 10. Run the app

```bash
npm run dev
```

Then open the Vite URL shown in the terminal.

## 11. Test in this order

1. Sign in as EM001.
2. Open Profile and edit the profile.
3. Open My Tasks.
4. Open a task.
5. Upload a PDF/PPT/image.
6. Submit it.
7. Sign out.
8. Sign in as EV001.
9. Open Submissions.
10. Open the submission.
11. Give marks and feedback.
12. Save evaluation.
13. Sign back in as EM001 and check the submission/leaderboard.

## 12. Account IDs for your first rollout

Suggested member IDs:

- EM001 … EM024 — Extra Milers / participant slots
- M001 … M004 — senior mentors, if needed
- EV001 … EV004 — evaluators/reviewers
- ADMIN001 — admin

The code does not hard-code a 24-user limit. You can add more later.

## 13. About the Admin/editor system

The frontend currently treats `admin` as the management role and `evaluator` as the grading role.

Next backend phase can add granular permissions such as:

- `manageTasks`
- `manageUsers`
- `manageOpportunities`
- `manageEvents`
- `manageMentors`
- `gradeSubmissions`
- `publishAnnouncements`

That is safer than giving every editor full admin access.

## 14. Firebase setup should be done before production

Do not put Firebase Admin SDK private keys or service-account JSON inside this React/Vite app. Any code shipped to the browser is public.

If we later build a true "Create user / reset password / assign role" admin screen, it should call a protected server-side function/endpoint using the Firebase Admin SDK.
