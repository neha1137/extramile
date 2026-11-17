import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Upload, Clock3, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getTask, getMySubmissions, createSubmission } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

function formatDue(value) {
  if (!value) return "No deadline";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function TaskDetails() {
  const { taskId } = useParams();
  const { firebaseUser, profile } = useAuth();
  const [task, setTask] = useState(null);
  const [existing, setExisting] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    Promise.all([getTask(taskId), getMySubmissions(firebaseUser.uid)])
      .then(([taskData, submissions]) => {
        setTask(taskData);
        setExisting(submissions.find((item) => item.taskId === taskId) || null);
      })
      .catch((err) => setError(err.message || "Could not load this task."))
      .finally(() => setLoading(false));
  }, [taskId, firebaseUser.uid]);

  async function handleSubmit() {
    if (!file) {
      setError("Choose a file before submitting.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const studentName = profile?.name || firebaseUser.displayName || profile?.userId || firebaseUser.uid;
      const teamName = profile?.teamName || "No-Team";
      const idToken = await firebaseUser.getIdToken();
      const apiBase = import.meta.env.VITE_DRIVE_API_URL || "";

      const initResponse = await fetch(`${apiBase}/api/drive/initiate-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          originalName: file.name,
          taskId,
        }),
      });
      const initData = await initResponse.json().catch(() => ({}));
      if (!initResponse.ok) throw new Error(initData.error || "Could not start the Google Drive upload.");

      // The browser sends the file directly to Google's resumable session.
      // Do not set Content-Length manually: browsers forbid scripts from setting it.
      const driveResponse = await fetch(initData.sessionUrl, {
        method: "PUT",
        body: file,
      });
      const driveData = await driveResponse.json().catch(() => ({}));
      if (!driveResponse.ok) throw new Error(driveData.error?.message || `Google Drive upload failed (${driveResponse.status}).`);

      const completeResponse = await fetch(`${apiBase}/api/drive/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fileId: driveData.id, uploadSessionId: initData.uploadSessionId }),
      });
      const completeData = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok) throw new Error(completeData.error || "The upload could not be verified.");

      await createSubmission({
        taskId,
        studentId: firebaseUser.uid,
        studentUserId: profile?.userId || "",
        fileName: completeData.file?.name || initData.fileName || file.name,
        fileType: completeData.file?.mimeType || file.type || "",
        fileSize: Number(completeData.file?.size || file.size || 0),
        fileUrl: completeData.file?.webViewLink || "",
        driveFileId: completeData.file?.id || driveData.id || null,
        driveUrl: completeData.file?.webViewLink || "",
        taskTitle: task.title,
        studentName,
        teamName,
        points: task.points || task.xp || 0,
        submissionMode: "google-drive",
      });
      setSubmitted(true);
      setExisting({ status: "pending", fileName: completeData.file?.name || file.name });
    } catch (err) {
      console.error(err);
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="task-details-page"><div className="panel loading-panel">Loading mission…</div></div>;
  if (!task) return <div className="task-details-page"><Link to="/app/tasks" className="back-app"><ArrowLeft size={15}/> All tasks</Link><div className="panel loading-panel">This task does not exist or is not active.</div></div>;

  const steps = task.steps || ["Read the task carefully.", "Complete the work with real evidence.", "Reflect on what you learned.", "Upload one clear final submission."];
  const alreadySubmitted = Boolean(existing || submitted);

  return <div className="task-details-page"><Link to="/app/tasks" className="back-app"><ArrowLeft size={15}/> All tasks</Link><div className="task-detail-layout"><main className="panel task-detail-main"><div className="detail-top"><span className="chapter-tag">{task.chapter || "EXTRA MILE"}</span><span className="detail-due"><Clock3 size={14}/> Due {formatDue(task.deadline || task.due)}</span></div><h1>{task.title}</h1><p className="detail-lead">{task.description}</p><div className="detail-rule"/><h3>What to do</h3><ol className="task-steps">{steps.map((s,i)=><li key={`${s}-${i}`}><span>{String(i+1).padStart(2,"0")}</span><p>{s}</p></li>)}</ol><div className="submission-box"><div className="submission-icon"><FileText size={20}/></div><div><strong>Your submission</strong><p>Upload the file type requested by the task. Your file will be uploaded to the connected Extra Miler Google Drive and its Drive link will be saved with your submission.</p></div><label className="upload-button"><Upload size={16}/> {file ? file.name : "Choose file"}<input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></div>{error&&<div className="login-error" role="alert">{error}</div>}{alreadySubmitted&&<div className="submission-success"><CheckCircle2 size={18}/><div><strong>{existing?.status === "reviewed" ? "Submission reviewed" : "Submission received"}</strong><p>Your evaluator can now review this task.</p></div></div>}<button className="primary-app-button wide" disabled={busy || alreadySubmitted} onClick={handleSubmit}>{busy?"Submitting…":alreadySubmitted?"Submitted":"Submit task"}<Send size={16}/></button></main><aside className="task-detail-side"><div className="panel points-card"><span className="app-kicker">TASK VALUE</span><strong>+{task.points || task.xp || 0}</strong><p>points when evaluated</p></div><div className="panel rubric-card"><span className="app-kicker">EVALUATION</span><h3>What your evaluator looks for</h3>{(task.rubric || ["Clarity of insight","Depth of learning","Evidence","Reflection"]).map((item) => <div key={item}>{typeof item === "string" ? item : item.name}<span>{typeof item === "string" ? "" : `${item.weight || 0}%`}</span></div>)}</div></aside></div></div>;
}
