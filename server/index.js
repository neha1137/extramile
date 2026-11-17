import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import admin from "firebase-admin";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive", "openid", "email", "profile"];
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 100 * 1024 * 1024);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function safeSegment(value, fallback = "Untitled") {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 100) || fallback;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/google/callback`
  );
}

let firebaseApp;

function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  if (admin.apps.length) {
    firebaseApp = admin.app();
    return firebaseApp;
  }

  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const serviceAccountPath = path.join(__dirname, "..", "firebase-service-account.json");
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON in server/.env (recommended) or provide firebase-service-account.json locally.");
    }
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return firebaseApp;
}

async function requireFirebaseUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in is required." });
    const idToken = header.slice("Bearer ".length);
    const decoded = await admin.auth(getFirebaseAdmin()).verifyIdToken(idToken);
    req.firebaseUser = decoded;
    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error?.message || error);
    return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const decoded = req.firebaseUser;
    const snap = await admin.firestore(getFirebaseAdmin()).collection("users").doc(decoded.uid).get();
    if (!snap.exists || snap.data()?.role !== "admin") return res.status(403).json({ error: "Admin access is required." });
    next();
  } catch (error) {
    console.error("Admin check failed:", error?.message || error);
    res.status(403).json({ error: "Admin access is required." });
  }
}


// Admin account creation: create the Firebase Authentication account and matching profile.
app.post("/api/admin/create-member", requireFirebaseUser, requireAdmin, async (req, res) => {
  let createdAuthUser = null;
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim();
    const role = String(req.body?.role || "").trim();
    const allowedRoles = new Set(["extra-miler", "mentor", "evaluator", "admin"]);
    const initialPassword = String(process.env.EXTRA_MILER_INITIAL_PASSWORD || "");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!name || name.length > 100) return res.status(400).json({ error: "Enter a name (up to 100 characters)." });
    if (!allowedRoles.has(role)) return res.status(400).json({ error: "Choose a valid role." });
    if (initialPassword.length < 6) {
      return res.status(503).json({ error: "Account creation is not configured. Set EXTRA_MILER_INITIAL_PASSWORD (at least 6 characters) in the backend environment." });
    }

    const app = getFirebaseAdmin();
    const auth = admin.auth(app);
    const database = admin.firestore(app);
    try {
      createdAuthUser = await auth.createUser({ email, password: initialPassword, displayName: name, emailVerified: false, disabled: false });
    } catch (error) {
      if (error?.code === "auth/email-already-exists") {
        return res.status(409).json({ error: "An account with this email already exists. Use the existing-account role assignment flow instead." });
      }
      if (error?.code === "auth/invalid-password") return res.status(400).json({ error: "The configured starter password is invalid. Use at least 6 characters." });
      throw error;
    }

    const prefixes = { "extra-miler": "EM", mentor: "M", evaluator: "EV", admin: "AD" };
    const counterRef = database.collection("appConfig").doc("memberIdCounters");
    let userId = "";
    try {
      await database.runTransaction(async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const counters = counterSnap.exists ? (counterSnap.data() || {}) : {};
        let next = Number(counters[role] || 0) + 1;
        // Skip IDs already present from accounts created before automatic ID generation.
        for (let attempt = 0; attempt < 1000; attempt += 1) {
          const candidate = `${prefixes[role]}${String(next).padStart(3, "0")}`;
          const existing = await transaction.get(database.collection("users").where("userId", "==", candidate).limit(1));
          if (existing.empty) { userId = candidate; break; }
          next += 1;
        }
        if (!userId) throw new Error("Could not allocate a unique member ID.");
        transaction.set(counterRef, { [role]: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      const profile = {
        uid: createdAuthUser.uid,
        userId,
        email,
        name,
        role,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await database.collection("users").doc(createdAuthUser.uid).set(profile);
      return res.status(201).json({ ok: true, user: { uid: createdAuthUser.uid, email, name, role, userId }, starterPasswordConfigured: true });
    } catch (error) {
      await auth.deleteUser(createdAuthUser.uid).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Member account creation failed:", error?.message || error);
    return res.status(500).json({ error: "Could not create this account. Check the backend logs and Firebase Admin configuration." });
  }
});

// Admin role assignment: link an existing Firebase Authentication account to its Extra Miler profile.
app.post("/api/admin/assign-role", requireFirebaseUser, requireAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const userId = String(req.body?.userId || "").trim().toUpperCase();
    const name = String(req.body?.name || "").trim();
    const role = String(req.body?.role || "").trim();
    const allowedRoles = new Set(["extra-miler", "mentor", "evaluator", "admin"]);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!userId || userId.length > 40 || /\s/.test(userId)) {
      return res.status(400).json({ error: "Enter a unique ID without spaces (for example EM001, M001 or EV001)." });
    }
    if (!allowedRoles.has(role)) return res.status(400).json({ error: "Choose a valid role." });

    const auth = admin.auth(getFirebaseAdmin());
    let authUser;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        return res.status(404).json({ error: "No Firebase Authentication account exists for this email yet. Create the account in Firebase Authentication first, then assign its role here." });
      }
      throw error;
    }

    const database = admin.firestore(getFirebaseAdmin());
    const users = database.collection("users");
    const [uidDoc, emailMatches, idMatches] = await Promise.all([
      users.doc(authUser.uid).get(),
      users.where("email", "==", email).limit(5).get(),
      users.where("userId", "==", userId).limit(5).get(),
    ]);

    const conflictingId = idMatches.docs.find((item) => item.id !== authUser.uid && item.data()?.email?.toLowerCase() !== email);
    if (conflictingId) return res.status(409).json({ error: `The ID ${userId} is already assigned to another account.` });

    const existingProfile = uidDoc.exists
      ? uidDoc.data()
      : (emailMatches.docs.find((item) => item.id === authUser.uid)?.data()
        || emailMatches.docs[0]?.data()
        || idMatches.docs.find((item) => item.data()?.email?.toLowerCase() === email)?.data()
        || {});

    const profile = {
      ...existingProfile,
      userId,
      email,
      name: name || existingProfile.name || authUser.displayName || userId,
      role,
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await users.doc(authUser.uid).set(profile, { merge: true });

    // If an older profile was keyed by an ID instead of the Firebase UID, deactivate it
    // so it no longer appears as a duplicate in public people/leaderboard lists.
    for (const oldDoc of [...emailMatches.docs, ...idMatches.docs]) {
      if (oldDoc.id !== authUser.uid && oldDoc.data()?.email?.toLowerCase() === email) {
        await oldDoc.ref.set({ active: false, migratedToUid: authUser.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    return res.json({ ok: true, user: { uid: authUser.uid, email, userId, name: profile.name, role, active: true } });
  } catch (error) {
    console.error("Role assignment failed:", error?.message || error);
    return res.status(500).json({ error: "Could not assign this role. Check the backend logs and Firebase Admin configuration." });
  }
});

async function getDriveConfig() {
  const snap = await admin.firestore(getFirebaseAdmin()).collection("appConfig").doc("googleDrive").get();
  return snap.exists ? snap.data() : {};
}
async function getRefreshToken() {
  const cfg = await getDriveConfig();
  return cfg.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || "";
}

async function getAuthorizedClient() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

async function findOrCreateFolder(drive, name, parentId = null) {
  const escapedName = name.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const response = await drive.files.list({
    q: `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentClause}`,
    spaces: "drive",
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
  });
  if (response.data.files?.[0]) return response.data.files[0];

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id,name,webViewLink",
  });
  return created.data;
}

async function prepareUploadMetadata(body) {
  const studentUserId = safeSegment(body.studentUserId, "student");
  const studentName = safeSegment(body.studentName, studentUserId);
  const teamName = safeSegment(body.teamName, "No-Team");
  const taskId = safeSegment(body.taskId, "task");
  const taskTitle = safeSegment(body.taskTitle, taskId);
  const originalName = safeSegment(body.originalName, "submission");
  const extension = path.extname(originalName).slice(0, 12);
  const finalFileName = `${studentUserId}_${studentName}_${teamName}_${taskId}_${taskTitle}${extension}`;

  const auth = await getAuthorizedClient();
  if (!auth) throw new Error("GOOGLE_REFRESH_TOKEN is not configured. Connect the organization Drive once before deploying.");
  const drive = google.drive({ version: "v3", auth });

  const rootFolder = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    ? { id: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID }
    : await findOrCreateFolder(drive, "Extra Miler Submissions");
  const teamFolder = await findOrCreateFolder(drive, teamName, rootFolder.id);
  const studentFolder = await findOrCreateFolder(drive, `${studentUserId}_${studentName}`, teamFolder.id);
  const taskFolder = await findOrCreateFolder(drive, `${taskId}_${taskTitle}`, studentFolder.id);

  return { auth, drive, rootFolder, teamFolder, studentFolder, taskFolder, finalFileName };
}

// Password reset: Firebase Auth accounts use an internal User-ID email, so send the Firebase action link to the verified contact email stored on the user's profile.
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    if (!userId) return res.status(400).json({ error: "Enter your Extra Miler User ID." });
    const database = admin.firestore(getFirebaseAdmin());
    const snap = await database.collection("users").where("userId", "==", userId).limit(1).get();
    // Same generic response avoids exposing whether an account exists.
    const generic = { ok: true, message: "If this account has a verified recovery email, a password-reset link will be sent shortly." };
    if (snap.empty) return res.json(generic);
    const profile = snap.docs[0].data();
    const email = String(profile.verifiedEmail || profile.email || "").trim();
    const verified = profile.emailVerified === true || profile.verifiedEmailVerified === true;
    if (!email || !verified) return res.json(generic);
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.MAIL_FROM) {
      return res.status(503).json({ error: "Password-reset email is not configured yet. Admin: add SMTP settings to server/.env." });
    }
    const internalEmail = `${userId.toLowerCase()}@extramiler.app`;
    const link = await admin.auth(getFirebaseAdmin()).generatePasswordResetLink(internalEmail, {
      url: process.env.PASSWORD_RESET_CONTINUE_URL || "http://localhost:5173/login",
      handleCodeInApp: false,
    });
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Reset your Extra Mile password",
      text: `We received a request to reset your Extra Mile password. Use this link to choose a new password:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>We received a request to reset your Extra Mile password.</p><p><a href="${link}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
    return res.json(generic);
  } catch (error) {
    console.error("Password reset request failed:", error?.message || error);
    return res.status(500).json({ error: "Could not send the reset email. Please try again or contact the Extra Mile admin." });
  }
});

app.get("/api/health", async (_req, res) => {
  const token = await getRefreshToken();
  const cfg = await getDriveConfig();
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && token);
  res.json({ ok: true, googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), driveConnected: configured, rootFolderId: cfg.rootFolderId || null, resumableUploads: true });
});

// Local-only helper. Production uses GOOGLE_REFRESH_TOKEN stored in Vercel env vars.

app.get("/api/google/auth-url", requireFirebaseUser, requireAdmin, async (req, res) => {
  try {
    const state = admin.firestore(getFirebaseAdmin()).collection("googleDriveOAuthStates").doc().id;
    await admin.firestore(getFirebaseAdmin()).collection("googleDriveOAuthStates").doc(state).set({ adminUid: req.firebaseUser.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    const oauth2Client = getOAuthClient();
    res.json({ url: oauth2Client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: DRIVE_SCOPES, state }) });
  } catch (error) { res.status(500).json({ error: "Could not start Google Drive connection." }); }
});

app.get("/api/google/status", requireFirebaseUser, requireAdmin, async (_req, res) => {
  try { const cfg = await getDriveConfig(); let folder = null; const auth = await getAuthorizedClient(); if (auth && cfg.rootFolderId) { try { folder = (await google.drive({version:"v3",auth}).files.get({fileId:cfg.rootFolderId,fields:"id,name,webViewLink,mimeType"})).data; } catch {} } res.json({ connected: Boolean(await getRefreshToken()), email: cfg.connectedEmail || "", folder }); }
  catch { res.status(500).json({ error: "Could not load Google Drive settings." }); }
});

app.get("/api/google/folders", requireFirebaseUser, requireAdmin, async (_req, res) => {
  try { const auth = await getAuthorizedClient(); if (!auth) return res.status(503).json({error:"Connect Google Drive first."}); const drive=google.drive({version:"v3",auth}); const r=await drive.files.list({q:"mimeType = 'application/vnd.google-apps.folder' and trashed = false",orderBy:"name",pageSize:100,fields:"files(id,name,webViewLink)"}); res.json({folders:r.data.files||[]}); }
  catch { res.status(500).json({error:"Could not list Google Drive folders."}); }
});

app.post("/api/google/folder", requireFirebaseUser, requireAdmin, async (req, res) => {
  try { const auth=await getAuthorizedClient(); if(!auth)return res.status(503).json({error:"Connect Google Drive first."}); const drive=google.drive({version:"v3",auth}); let folder; if(req.body.folderId){ folder=(await drive.files.get({fileId:String(req.body.folderId),fields:"id,name,webViewLink,mimeType"})).data; if(folder.mimeType!=="application/vnd.google-apps.folder")throw new Error("Selected item is not a folder."); } else { folder=await findOrCreateFolder(drive,String(req.body.name||"Extra Miler Submissions")); } await admin.firestore(getFirebaseAdmin()).collection("appConfig").doc("googleDrive").set({rootFolderId:folder.id,rootFolderName:folder.name,rootFolderUrl:folder.webViewLink||"",updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true}); res.json({ok:true,folder}); }
  catch(e){res.status(500).json({error:e.message||"Could not save submission folder."});}
});

app.get("/api/google/auth", (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send("Google OAuth is not configured. Check server/.env.");
  }
  const oauth2Client = getOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: DRIVE_SCOPES,
    prompt: "consent",
  });
  res.redirect(authUrl);
});

// Local callback only. It displays the refresh token so it can be copied to Vercel.
app.get("/api/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing Google authorization code.");
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send("Google did not return a refresh token. Re-run the connection with prompt=consent and revoke the old app authorization if necessary.");
    }
    const escaped = JSON.stringify(tokens.refresh_token);
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Extra Miler — Drive Connected</title><style>body{font-family:system-ui;background:#070714;color:#fff;display:grid;place-items:center;min-height:100vh}main{max-width:720px;padding:40px;border:1px solid #28284a;border-radius:24px;background:#111124}h1{margin:0 0 10px}p{color:#aaaad0;line-height:1.6}code{display:block;word-break:break-all;padding:14px;background:#080812;border-radius:12px;color:#c9f269}</style></head><body><main><h1>Google Drive connected ✓</h1><p>Copy this refresh token into your Vercel environment variable named <b>GOOGLE_REFRESH_TOKEN</b>. Never commit it to GitHub or put it in React code.</p><code>${escaped.slice(1, -1)}</code><p>After adding the variable to Vercel, redeploy the project.</p></main></body></html>`);
  } catch (error) {
    console.error("Google OAuth error:", error?.response?.data || error);
    res.status(500).send("Google Drive connection failed. Check the backend terminal for details.");
  }
});

app.get("/api/unstop/preview", requireFirebaseUser, requireAdmin, async (req, res) => {
  try {
    const target = String(req.query?.url || "").trim();
    if (!/^https?:\/\/(www\.)?unstop\.com\//i.test(target)) return res.status(400).json({ error: "Please provide a public Unstop URL." });
    const response = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 ExtraMilerOpportunityImporter/1.0", "Accept": "text/html,application/xhtml+xml" }, redirect: "follow" });
    if (!response.ok) return res.status(502).json({ error: `Unstop returned ${response.status}. You can still enter the details manually.` });
    const html = await response.text();
    const decode = (value) => String(value || "").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
    const meta = (name) => { const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"); const m=html.match(re); return decode(m?.[1]||m?.[2]||""); };
    const title = meta("og:title") || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g,"").trim();
    const description = meta("og:description") || meta("description");
    const image = meta("og:image");
    const text = html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
    const orgMatch = text.match(/(?:by|organised by|organized by|hosted by)\s+([A-Z][A-Za-z0-9 .&_-]{2,80})/i);
    const deadlineMatch = text.match(/(?:registration|application|entry)?\s*deadline\s*[:|-]?\s*([A-Za-z0-9,\- ]{5,40})/i);
    const locationMatch = text.match(/(?:location|venue)\s*[:|-]?\s*([A-Za-z0-9 ,.&_-]{3,80})/i);
    const tag = /hackathon/i.test(title+" "+text) ? "HACKATHON" : /competition|challenge/i.test(title+" "+text) ? "COMPETITION" : "UNSTOP";
    res.json({ ok:true, url:target, title:decode(title), org:decode(orgMatch?.[1]||"Unstop"), description:decode(description).slice(0,1200), image, deadline:decode(deadlineMatch?.[1]||""), date:decode(deadlineMatch?.[1]||""), location:decode(locationMatch?.[1]||"Online"), tag });
  } catch (error) {
    console.error("Unstop preview failed:", error?.message || error);
    res.status(502).json({ error: "Could not read that Unstop page. Enter the opportunity details manually and keep the Unstop URL." });
  }
});

app.get("/api/google/test", requireFirebaseUser, async (_req, res) => {
  try {
    const auth = await getAuthorizedClient();
    if (!auth) return res.status(503).json({ connected: false, error: "Organization Google Drive is not connected yet." });
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.list({ pageSize: 10, fields: "files(id,name,mimeType,webViewLink)", q: "trashed = false" });
    res.json({ connected: true, files: response.data.files || [] });
  } catch (error) {
    console.error("Drive test error:", error?.response?.data || error);
    res.status(500).json({ connected: false, error: "Could not access Google Drive." });
  }
});

// Create a short-lived Drive resumable session. File bytes travel from the browser
// straight to Google Drive; this Express server only authorizes and verifies the transfer.
app.post("/api/drive/initiate-upload", requireFirebaseUser, async (req, res) => {
  try {
    const size = Number(req.body?.fileSize || 0);
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File must be between 1 byte and ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.` });
    }
    const taskId = String(req.body?.taskId || "").trim();
    const originalName = String(req.body?.originalName || "").trim();
    const mimeType = String(req.body?.mimeType || "application/octet-stream").slice(0, 150);
    if (!taskId || taskId.length > 150) return res.status(400).json({ error: "A valid task is required." });
    if (!originalName || originalName.length > 255) return res.status(400).json({ error: "Choose a valid file name (maximum 255 characters)." });

    const database = admin.firestore(getFirebaseAdmin());
    const [profileSnap, taskSnap] = await Promise.all([
      database.collection("users").doc(req.firebaseUser.uid).get(),
      database.collection("tasks").doc(taskId).get(),
    ]);
    if (!profileSnap.exists || profileSnap.data()?.active === false || profileSnap.data()?.role !== "extra-miler") {
      return res.status(403).json({ error: "Only active Extra Milers can submit task files." });
    }
    if (!taskSnap.exists || taskSnap.data()?.active !== true) return res.status(404).json({ error: "This task is unavailable for submission." });
    const task = taskSnap.data();
    if (task.submissionType && task.submissionType !== "file") return res.status(400).json({ error: "This task does not accept file uploads." });

    const profile = profileSnap.data();
    const uploadMetadata = {
      studentUserId: profile.userId || req.firebaseUser.uid,
      studentName: profile.name || req.firebaseUser.name || profile.userId || req.firebaseUser.uid,
      teamName: profile.teamName || "No-Team",
      taskId,
      taskTitle: task.title || taskId,
      originalName,
    };
    const { taskFolder, finalFileName } = await prepareUploadMetadata(uploadMetadata);
    const authClient = await getAuthorizedClient();
    if (!authClient) return res.status(503).json({ error: "Organization Google Drive is not connected." });
    const accessTokenResponse = await authClient.getAccessToken();
    const accessToken = typeof accessTokenResponse === "string" ? accessTokenResponse : accessTokenResponse?.token;
    if (!accessToken) throw new Error("Could not obtain a Google access token.");

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({ name: finalFileName, parents: [taskFolder.id] }),
    });
    if (!response.ok) throw new Error(`Google upload session failed (${response.status}): ${await response.text()}`);
    const sessionUrl = response.headers.get("location");
    if (!sessionUrl) throw new Error("Google did not return an upload session URL.");

    const uploadSessionId = randomUUID();
    await database.collection("driveUploadSessions").doc(uploadSessionId).set({
      uid: req.firebaseUser.uid,
      taskId,
      taskFolderId: taskFolder.id,
      fileName: finalFileName,
      mimeType,
      expectedSize: size,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });
    return res.json({ ok: true, sessionUrl, uploadSessionId, fileName: finalFileName });
  } catch (error) {
    console.error("Drive upload initiation error:", error?.response?.data || error?.message || error);
    return res.status(500).json({ error: "Could not start the Google Drive upload. Check that the organization Drive is connected." });
  }
});

// Verify the uploaded Drive file against the caller's short-lived upload session.
app.post("/api/drive/complete", requireFirebaseUser, async (req, res) => {
  try {
    const fileId = String(req.body?.fileId || "").trim();
    const uploadSessionId = String(req.body?.uploadSessionId || "").trim();
    if (!fileId || !uploadSessionId) return res.status(400).json({ error: "Missing upload verification details." });
    const database = admin.firestore(getFirebaseAdmin());
    const sessionRef = database.collection("driveUploadSessions").doc(uploadSessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) return res.status(404).json({ error: "This upload session has expired. Please upload the file again." });
    const session = sessionSnap.data();
    if (session.uid !== req.firebaseUser.uid) return res.status(403).json({ error: "This upload session does not belong to your account." });
    if (!session.expiresAt || session.expiresAt.toMillis() < Date.now()) {
      await sessionRef.delete();
      return res.status(410).json({ error: "This upload session has expired. Please upload the file again." });
    }
    const auth = await getAuthorizedClient();
    if (!auth) return res.status(503).json({ error: "Organization Google Drive is not connected." });
    const drive = google.drive({ version: "v3", auth });
    const file = (await drive.files.get({ fileId, fields: "id,name,mimeType,size,webViewLink,webContentLink,parents" })).data;
    if (file.name !== session.fileName || !Array.isArray(file.parents) || !file.parents.includes(session.taskFolderId) || Number(file.size) !== Number(session.expectedSize)) {
      return res.status(403).json({ error: "The uploaded file did not match the authorized upload session." });
    }
    await sessionRef.delete();
    return res.json({ ok: true, file });
  } catch (error) {
    console.error("Drive completion verification error:", error?.response?.data || error?.message || error);
    return res.status(500).json({ error: "The file upload could not be verified." });
  }
});

// Legacy endpoint retained for local development. It intentionally rejects large direct uploads;
// the production UI uses initiate-upload + direct resumable upload instead.
app.post("/api/drive/upload", requireFirebaseUser, (_req, res) => {
  res.status(410).json({ error: "Direct server upload has been replaced with a resumable Google Drive upload. Please use the latest Extra Miler frontend." });
});

app.listen(PORT, () => console.log(`Extra Miler Drive backend running on http://localhost:${PORT}`));
