import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
dotenv.config({ path: envPath });
const port = Number(process.env.PORT || 4000);
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/api/google/callback`;
const app = express();
app.use(cors());

const oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
const scopes = ["https://www.googleapis.com/auth/drive.file"];

app.get("/api/google/auth", (_req, res) => {
  const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: scopes });
  res.redirect(url);
});

app.get("/api/google/callback", async (req, res) => {
  try {
    const { tokens } = await oauth.getToken(String(req.query.code || ""));
    if (!tokens.refresh_token) throw new Error("No refresh token returned. Revoke the app in Google Account permissions and try again.");
    let envText = "";
    try { envText = await fs.readFile(envPath, "utf8"); } catch { envText = ""; }
    const lines = envText.split(/\r?\n/).filter((line) => !line.startsWith("GOOGLE_REFRESH_TOKEN="));
    lines.push(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    await fs.writeFile(envPath, `${lines.filter(Boolean).join("\n")}\n`, { mode: 0o600 });
    res.send("<h2>Google Drive connected ✓</h2><p>GOOGLE_REFRESH_TOKEN was saved to server/.env. You can close this tab and start the server normally.</p>");
  } catch (error) {
    console.error(error);
    res.status(500).send(`Google authorization failed: ${error.message}`);
  }
});

app.listen(port, () => console.log(`Open http://localhost:${port}/api/google/auth to connect the organization Google Drive once.`));
