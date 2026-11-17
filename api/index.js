import express from "express";
import cors from "cors";
import { google } from "googleapis";
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive", "openid", "email", "profile"];
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 100 * 1024 * 1024);
let firebaseApp;
function getFirebaseAdmin(){
  if(firebaseApp) return firebaseApp;
  if(admin.apps.length) return (firebaseApp=admin.app());
  if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
  firebaseApp=admin.initializeApp({credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});
  return firebaseApp;
}
function db(){ return admin.firestore(getFirebaseAdmin()); }
function oauth(){ return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/google/callback"); }
function safeSegment(value,fallback="Untitled"){return String(value||fallback).trim().replace(/[\\/:*?"<>|#%{}~&]/g,"-").replace(/\s+/g,"_").slice(0,100)||fallback;}
async function requireFirebaseUser(req,res,next){try{const h=req.headers.authorization||"";if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Sign in is required."});req.firebaseUser=await admin.auth(getFirebaseAdmin()).verifyIdToken(h.slice(7));next();}catch(e){res.status(401).json({error:"Your session is invalid or expired. Please sign in again."});}}
async function requireAdmin(req,res,next){try{const snap=await db().collection("users").doc(req.firebaseUser.uid).get();if(!snap.exists||snap.data()?.role!=="admin") return res.status(403).json({error:"Admin access is required."});next();}catch(e){res.status(403).json({error:"Admin access is required."});}}
// Admin account creation: create Firebase Authentication and the matching Firestore profile.
app.post("/api/admin/create-member",requireFirebaseUser,requireAdmin,async(req,res)=>{
  let createdAuthUser=null;
  try{
    const email=String(req.body?.email||"").trim().toLowerCase();
    const name=String(req.body?.name||"").trim();
    const role=String(req.body?.role||"").trim();
    const allowedRoles=new Set(["extra-miler","mentor","evaluator","admin"]);
    const initialPassword=String(process.env.EXTRA_MILER_INITIAL_PASSWORD||"");
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});
    if(!name||name.length>100)return res.status(400).json({error:"Enter a name (up to 100 characters)."});
    if(!allowedRoles.has(role))return res.status(400).json({error:"Choose a valid role."});
    if(initialPassword.length<6)return res.status(503).json({error:"Account creation is not configured. Set EXTRA_MILER_INITIAL_PASSWORD (at least 6 characters) in the Vercel environment variables."});
    const auth=admin.auth(getFirebaseAdmin());
    try{createdAuthUser=await auth.createUser({email,password:initialPassword,displayName:name,emailVerified:false,disabled:false});}
    catch(e){if(e?.code==="auth/email-already-exists")return res.status(409).json({error:"An account with this email already exists. Use the existing-account role assignment flow instead."});if(e?.code==="auth/invalid-password")return res.status(400).json({error:"The configured starter password is invalid. Use at least 6 characters."});throw e;}
    const database=db();
    const prefixes={"extra-miler":"EM",mentor:"M",evaluator:"EV",admin:"AD"};
    const counterRef=database.collection("appConfig").doc("memberIdCounters");
    let userId="";
    try{
      await database.runTransaction(async transaction=>{
        const snap=await transaction.get(counterRef);
        const counters=snap.exists?(snap.data()||{}):{};
        let next=Number(counters[role]||0)+1;
        for(let attempt=0;attempt<1000;attempt++){
          const candidate=`${prefixes[role]}${String(next).padStart(3,"0")}`;
          const existing=await transaction.get(database.collection("users").where("userId","==",candidate).limit(1));
          if(existing.empty){userId=candidate;break;}
          next++;
        }
        if(!userId)throw new Error("Could not allocate a unique member ID.");
        transaction.set(counterRef,{[role]:next,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      });
      await database.collection("users").doc(createdAuthUser.uid).set({uid:createdAuthUser.uid,userId,email,name,role,active:true,createdAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
      return res.status(201).json({ok:true,user:{uid:createdAuthUser.uid,email,name,role,userId}});
    }catch(e){await auth.deleteUser(createdAuthUser.uid).catch(()=>{});throw e;}
  }catch(e){console.error("Member account creation failed:",e?.message||e);return res.status(500).json({error:"Could not create this account. Check the Vercel logs and Firebase Admin configuration."});}
});

// Admin role assignment: link an existing Firebase Authentication account to its Extra Miler profile.
app.post("/api/admin/assign-role",requireFirebaseUser,requireAdmin,async(req,res)=>{try{
  const email=String(req.body?.email||"").trim().toLowerCase();
  const userId=String(req.body?.userId||"").trim().toUpperCase();
  const name=String(req.body?.name||"").trim();
  const role=String(req.body?.role||"").trim();
  const allowedRoles=new Set(["extra-miler","mentor","evaluator","admin"]);
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});
  if(!userId||userId.length>40||/\s/.test(userId))return res.status(400).json({error:"Enter a unique ID without spaces (for example EM001, M001 or EV001)."});
  if(!allowedRoles.has(role))return res.status(400).json({error:"Choose a valid role."});
  const auth=admin.auth(getFirebaseAdmin());let authUser;
  try{authUser=await auth.getUserByEmail(email);}catch(e){if(e?.code==="auth/user-not-found")return res.status(404).json({error:"No Firebase Authentication account exists for this email yet. Create the account in Firebase Authentication first, then assign its role here."});throw e;}
  const users=db().collection("users");
  const [uidDoc,emailMatches,idMatches]=await Promise.all([users.doc(authUser.uid).get(),users.where("email","==",email).limit(5).get(),users.where("userId","==",userId).limit(5).get()]);
  const conflict=idMatches.docs.find(d=>d.id!==authUser.uid&&String(d.data()?.email||"").toLowerCase()!==email);
  if(conflict)return res.status(409).json({error:`The ID ${userId} is already assigned to another account.`});
  const existing=uidDoc.exists?uidDoc.data():(emailMatches.docs[0]?.data()||idMatches.docs.find(d=>String(d.data()?.email||"").toLowerCase()===email)?.data()||{});
  const profile={...existing,userId,email,name:name||existing.name||authUser.displayName||userId,role,active:true,updatedAt:admin.firestore.FieldValue.serverTimestamp()};
  await users.doc(authUser.uid).set(profile,{merge:true});
  for(const old of [...emailMatches.docs,...idMatches.docs])if(old.id!==authUser.uid&&String(old.data()?.email||"").toLowerCase()===email)await old.ref.set({active:false,migratedToUid:authUser.uid,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  return res.json({ok:true,user:{uid:authUser.uid,email,userId,name:profile.name,role,active:true}});
}catch(e){console.error("Role assignment failed:",e?.message||e);return res.status(500).json({error:"Could not assign this role. Check the backend logs and Firebase Admin configuration."});}});

async function driveConfig(){const snap=await db().collection("appConfig").doc("googleDrive").get();return snap.exists?snap.data():{};}
async function getRefreshToken(){const cfg=await driveConfig();return cfg.refreshToken||process.env.GOOGLE_REFRESH_TOKEN||"";}
async function getAuthorizedClient(){const token=await getRefreshToken();if(!token)return null;const c=oauth();c.setCredentials({refresh_token:token});return c;}
async function saveConfig(data){await db().collection("appConfig").doc("googleDrive").set({...data,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});}
async function findOrCreateFolder(drive,name,parentId=null){const esc=name.replace(/'/g,"\\'");const parent=parentId?` and '${parentId}' in parents`:"";const r=await drive.files.list({q:`name = '${esc}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parent}`,spaces:"drive",fields:"files(id,name,webViewLink)",pageSize:1});if(r.data.files?.[0])return r.data.files[0];const c=await drive.files.create({requestBody:{name,mimeType:"application/vnd.google-apps.folder",...(parentId?{parents:[parentId]}:{})},fields:"id,name,webViewLink"});return c.data;}
async function prepareUpload(body){const auth=await getAuthorizedClient();if(!auth)throw new Error("Organization Google Drive is not connected. Ask an admin to connect Google Drive first.");const drive=google.drive({version:"v3",auth});const cfg=await driveConfig();const studentUserId=safeSegment(body.studentUserId,"student"),studentName=safeSegment(body.studentName,studentUserId),teamName=safeSegment(body.teamName,"No-Team"),taskId=safeSegment(body.taskId,"task"),taskTitle=safeSegment(body.taskTitle,taskId),originalName=safeSegment(body.originalName,"submission");const ext=originalName.includes(".")?`.${originalName.split(".").pop().slice(0,12)}`:"";const finalFileName=`${studentUserId}_${studentName}_${teamName}_${taskId}_${taskTitle}${ext}`;const root=cfg.rootFolderId?{id:cfg.rootFolderId}:await findOrCreateFolder(drive,"Extra Miler Submissions");const team=await findOrCreateFolder(drive,teamName,root.id);const student=await findOrCreateFolder(drive,`${studentUserId}_${studentName}`,team.id);const task=await findOrCreateFolder(drive,`${taskId}_${taskTitle}`,student.id);return{auth,drive,rootFolder:root,taskFolder:task,finalFileName};}

app.post("/api/auth/forgot-password",async(req,res)=>{try{const userId=String(req.body?.userId||"").trim();if(!userId)return res.status(400).json({error:"Enter your Extra Miler User ID."});const generic={ok:true,message:"If this account has a verified recovery email, a password-reset link will be sent shortly."};const snap=await db().collection("users").where("userId","==",userId).limit(1).get();if(snap.empty)return res.json(generic);const profile=snap.docs[0].data();const email=String(profile.verifiedEmail||profile.email||"").trim();if(!email||!(profile.emailVerified===true||profile.verifiedEmailVerified===true))return res.json(generic);if(!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS||!process.env.MAIL_FROM)return res.status(503).json({error:"Password-reset email is not configured. Add SMTP settings to your hosting environment."});const link=await admin.auth(getFirebaseAdmin()).generatePasswordResetLink(`${userId.toLowerCase()}@extramiler.app`,{url:process.env.PASSWORD_RESET_CONTINUE_URL||"https://example.com/login",handleCodeInApp:false});const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||"false")==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});await transporter.sendMail({from:process.env.MAIL_FROM,to:email,subject:"Reset your Extra Mile password",text:`Reset your Extra Mile password using this link:\n\n${link}\n\nIf you did not request this, ignore this email.`,html:`<p>Reset your Extra Mile password.</p><p><a href="${link}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`});return res.json(generic);}catch(e){console.error("Password reset request failed:",e?.message||e);return res.status(500).json({error:"Could not send the reset email. Please try again or contact the admin."});}});

app.get("/api/health",async(_req,res)=>{const cfg=await driveConfig();res.json({ok:true,googleConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),driveConnected:Boolean(cfg.refreshToken||process.env.GOOGLE_REFRESH_TOKEN),rootFolderId:cfg.rootFolderId||null});});

// Admin Drive setup: the browser asks for an OAuth URL with the Firebase ID token; OAuth state is persisted in Firestore.
app.get("/api/google/auth-url",requireFirebaseUser,requireAdmin,async(req,res)=>{try{const state=admin.firestore().collection("googleDriveOAuthStates").doc().id;await db().collection("googleDriveOAuthStates").doc(state).set({adminUid:req.firebaseUser.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});const c=oauth();const url=c.generateAuthUrl({access_type:"offline",prompt:"consent",scope:DRIVE_SCOPES,state});res.json({url});}catch(e){console.error(e);res.status(500).json({error:"Could not start Google Drive connection."});}});
app.get("/api/google/callback",async(req,res)=>{try{const state=String(req.query.state||""),code=String(req.query.code||"");if(!state||!code)return res.status(400).send("Missing Google authorization data.");const stateRef=db().collection("googleDriveOAuthStates").doc(state);const stateSnap=await stateRef.get();if(!stateSnap.exists)return res.status(400).send("This Google connection request expired. Start again from Admin → Google Drive Storage.");const c=oauth();const {tokens}=await c.getToken(code);if(!tokens.refresh_token)return res.status(400).send("Google did not return a refresh token. Revoke the old Extra Miler authorization and connect again.");c.setCredentials(tokens);let email="";try{email=(await c.request({url:"https://openidconnect.googleapis.com/v1/userinfo"})).data?.email||"";}catch{}await saveConfig({refreshToken:tokens.refresh_token,connectedEmail:email,connectedBy:stateSnap.data().adminUid});await stateRef.delete();res.send(`<!doctype html><html><body style="font-family:system-ui;background:#070714;color:white;display:grid;place-items:center;min-height:100vh"><main style="padding:40px;border:1px solid #29294a;border-radius:22px;background:#111124"><h1>Google Drive connected ✓</h1><p>You can close this tab and return to Extra Miler Admin.</p></main></body></html>`);}catch(e){console.error("OAuth callback",e);res.status(500).send("Google Drive connection failed. Return to Extra Miler Admin and try again.");}});
app.get("/api/google/status",requireFirebaseUser,requireAdmin,async(req,res)=>{try{const cfg=await driveConfig();let folder=null;if(cfg.rootFolderId){const c=await getAuthorizedClient();if(c){try{folder=(await google.drive({version:"v3",auth:c}).files.get({fileId:cfg.rootFolderId,fields:"id,name,webViewLink,mimeType"})).data;}catch{}}}res.json({connected:Boolean(cfg.refreshToken||process.env.GOOGLE_REFRESH_TOKEN),email:cfg.connectedEmail||"",folder});}catch(e){res.status(500).json({error:"Could not load Google Drive settings."});}});
app.get("/api/google/folders",requireFirebaseUser,requireAdmin,async(req,res)=>{try{const c=await getAuthorizedClient();if(!c)return res.status(503).json({error:"Connect Google Drive first."});const drive=google.drive({version:"v3",auth:c});const r=await drive.files.list({q:"mimeType = 'application/vnd.google-apps.folder' and trashed = false",orderBy:"name",pageSize:100,fields:"files(id,name,webViewLink)"});res.json({folders:r.data.files||[]});}catch(e){res.status(500).json({error:"Could not list Google Drive folders."});}});
app.post("/api/google/folder",requireFirebaseUser,requireAdmin,async(req,res)=>{try{const c=await getAuthorizedClient();if(!c)return res.status(503).json({error:"Connect Google Drive first."});const drive=google.drive({version:"v3",auth:c});let folder=null;if(req.body.folderId){folder=(await drive.files.get({fileId:String(req.body.folderId),fields:"id,name,webViewLink,mimeType"})).data;if(folder.mimeType!=="application/vnd.google-apps.folder")throw new Error("Selected item is not a folder.");}else{folder=await findOrCreateFolder(drive,String(req.body.name||"Extra Miler Submissions"));}await saveConfig({rootFolderId:folder.id,rootFolderName:folder.name,rootFolderUrl:folder.webViewLink||""});res.json({ok:true,folder});}catch(e){res.status(500).json({error:e.message||"Could not save submission folder."});}});

app.get("/api/unstop/preview",requireFirebaseUser,requireAdmin,async(req,res)=>{const target=String(req.query?.url||"").trim();if(!/^https?:\/\/(www\.)?unstop\.com\//i.test(target))return res.status(400).json({error:"Please paste a public Unstop URL."});try{const response=await fetch(target,{headers:{"User-Agent":"Mozilla/5.0 (compatible; ExtraMiler/1.0)",Accept:"text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"},redirect:"follow"});const html=await response.text();if(!response.ok) return res.status(502).json({error:`Unstop returned HTTP ${response.status}. The URL is valid, but Unstop did not allow the server to read its page. You can enter the details manually and keep the Unstop link.`});if(!html.trim())return res.status(502).json({error:"Unstop returned an empty page. Enter the details manually and keep the Unstop link."});const decode=v=>String(v||"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();const meta=name=>{const re=new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`,"i");const m=html.match(re);return decode(m?.[1]||m?.[2]||"")};const title=meta("og:title")||decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"").replace(/<[^>]+>/g,"");const description=meta("og:description")||meta("description");const image=meta("og:image");const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ");const org=decode((text.match(/(?:by|organised by|organized by|hosted by)\s+([A-Z][A-Za-z0-9 .&_-]{2,80})/i)||[])[1]||"Unstop");const deadline=decode((text.match(/(?:registration|application|entry)?\s*deadline\s*[:|-]?\s*([A-Za-z0-9,\- ]{5,40})/i)||[])[1]||"");const location=decode((text.match(/(?:location|venue)\s*[:|-]?\s*([A-Za-z0-9 ,.&_-]{3,80})/i)||[])[1]||"Online");const tag=/hackathon/i.test(title+" "+text)?"HACKATHON":/competition|challenge/i.test(title+" "+text)?"COMPETITION":"UNSTOP";res.json({ok:true,url:target,title,org,description:description.slice(0,1200),image,deadline,date:deadline,location,tag});}catch(e){console.error("Unstop preview",e);res.status(502).json({error:"Could not read that Unstop page from the server. You can still publish it by entering the title, organizer, deadline and other details manually."});}});

// Create a short-lived Drive resumable session. The browser transfers bytes directly to
// Google's upload endpoint; this Vercel function never receives or buffers the file body.
app.post("/api/drive/initiate-upload",requireFirebaseUser,async(req,res)=>{
  try{
    const size=Number(req.body?.fileSize||0);
    if(!Number.isSafeInteger(size)||size<1||size>MAX_FILE_SIZE)return res.status(400).json({error:`File must be between 1 byte and ${Math.round(MAX_FILE_SIZE/1024/1024)} MB.`});
    const taskId=String(req.body?.taskId||"").trim();
    const originalName=String(req.body?.originalName||"").trim();
    const mimeType=String(req.body?.mimeType||"application/octet-stream").slice(0,150);
    if(!taskId||taskId.length>150)return res.status(400).json({error:"A valid task is required."});
    if(!originalName||originalName.length>255)return res.status(400).json({error:"Choose a valid file name (maximum 255 characters)."});

    const database=db();
    const [profileSnap,taskSnap]=await Promise.all([
      database.collection("users").doc(req.firebaseUser.uid).get(),
      database.collection("tasks").doc(taskId).get(),
    ]);
    if(!profileSnap.exists||profileSnap.data()?.active===false||profileSnap.data()?.role!=="extra-miler")return res.status(403).json({error:"Only active Extra Milers can submit task files."});
    if(!taskSnap.exists||taskSnap.data()?.active!==true)return res.status(404).json({error:"This task is unavailable for submission."});
    const task=taskSnap.data();
    if(task.submissionType&&task.submissionType!=="file")return res.status(400).json({error:"This task does not accept file uploads."});

    const profile=profileSnap.data();
    const uploadBody={
      studentUserId:profile.userId||req.firebaseUser.uid,
      studentName:profile.name||req.firebaseUser.name||profile.userId||req.firebaseUser.uid,
      teamName:profile.teamName||"No-Team",
      taskId,
      taskTitle:task.title||taskId,
      originalName,
    };
    const {taskFolder,finalFileName}=await prepareUpload(uploadBody);
    const auth=await getAuthorizedClient();
    if(!auth)return res.status(503).json({error:"Organization Google Drive is not connected."});
    const tokenResult=await auth.getAccessToken();
    const accessToken=typeof tokenResult==="string"?tokenResult:tokenResult?.token;
    if(!accessToken)throw new Error("Could not obtain a Google access token.");
    const response=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",{
      method:"POST",
      headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(size)},
      body:JSON.stringify({name:finalFileName,parents:[taskFolder.id]}),
    });
    if(!response.ok)throw new Error(`Google upload session failed (${response.status}): ${await response.text()}`);
    const sessionUrl=response.headers.get("location");
    if(!sessionUrl)throw new Error("Google did not return an upload session URL.");

    const uploadSessionId=randomUUID();
    await database.collection("driveUploadSessions").doc(uploadSessionId).set({
      uid:req.firebaseUser.uid,taskId,taskFolderId:taskFolder.id,fileName:finalFileName,mimeType,
      expectedSize:size,createdAt:admin.firestore.FieldValue.serverTimestamp(),
      expiresAt:admin.firestore.Timestamp.fromMillis(Date.now()+60*60*1000),
    });
    return res.json({ok:true,sessionUrl,uploadSessionId,fileName:finalFileName});
  }catch(e){
    console.error("Drive upload initiation",e?.response?.data||e?.message||e);
    return res.status(500).json({error:"Could not start the Google Drive upload. Check that the organization Drive is connected."});
  }
});

// Verify that the completed file belongs to this user's unexpired upload session.
app.post("/api/drive/complete",requireFirebaseUser,async(req,res)=>{
  try{
    const fileId=String(req.body?.fileId||"").trim();
    const uploadSessionId=String(req.body?.uploadSessionId||"").trim();
    if(!fileId||!uploadSessionId)return res.status(400).json({error:"Missing upload verification details."});
    const database=db();
    const sessionRef=database.collection("driveUploadSessions").doc(uploadSessionId);
    const sessionSnap=await sessionRef.get();
    if(!sessionSnap.exists)return res.status(404).json({error:"This upload session has expired. Please upload the file again."});
    const session=sessionSnap.data();
    if(session.uid!==req.firebaseUser.uid)return res.status(403).json({error:"This upload session does not belong to your account."});
    if(!session.expiresAt||session.expiresAt.toMillis()<Date.now()){
      await sessionRef.delete();
      return res.status(410).json({error:"This upload session has expired. Please upload the file again."});
    }
    const auth=await getAuthorizedClient();
    if(!auth)return res.status(503).json({error:"Organization Google Drive is not connected."});
    const drive=google.drive({version:"v3",auth});
    const file=(await drive.files.get({fileId,fields:"id,name,mimeType,size,webViewLink,webContentLink,parents"})).data;
    if(file.name!==session.fileName||!Array.isArray(file.parents)||!file.parents.includes(session.taskFolderId)||Number(file.size)!==Number(session.expectedSize)){
      return res.status(403).json({error:"The uploaded file did not match the authorized upload session."});
    }
    await sessionRef.delete();
    return res.json({ok:true,file});
  }catch(e){
    console.error("Drive upload verification",e?.response?.data||e?.message||e);
    return res.status(500).json({error:"The file upload could not be verified."});
  }
});
export default app;
