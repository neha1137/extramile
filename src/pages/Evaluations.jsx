import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Plus, Search, UserRound, X } from "lucide-react";
import { createTask, subscribeToPeople, subscribeToSubmissionQueue, updateSubmission } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

function displayDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const emptyTask = {
  title: "",
  chapter: "",
  description: "",
  deadline: "",
  points: 100,
  maxMarks: 100,
  submissionType: "file",
  order: 999,
};

export default function Evaluations() {
  const { role, firebaseUser } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [taskSuccess, setTaskSuccess] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsubscribeSubmissions = subscribeToSubmissionQueue(
      (items) => { setSubmissions(items); setLoading(false); },
      (err) => { setError(err.message || "Could not load submissions from Firebase."); setLoading(false); },
    );
    const unsubscribePeople = subscribeToPeople(
      (items) => setPeople(items),
      (err) => setError((current) => current || err.message || "Could not load Extra Miler profiles."),
    );
    return () => { unsubscribeSubmissions(); unsubscribePeople(); };
  }, []);

  const personByUid = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const filtered = submissions.filter((submission) => {
    const person = personByUid[submission.studentId];
    const text = `${person?.name || submission.studentUserId || ""} ${submission.taskTitle || ""} ${submission.status || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const pending = submissions.filter((s) => s.status !== "reviewed").length;
  const reviewed = submissions.length - pending;

  function openReview(item) {
    setSelected(item);
    setMarks(item.marks ?? "");
    setFeedback(item.feedback || "");
    setError("");
  }

  async function saveReview() {
    const numericMarks = Number(marks);
    if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > 100) {
      setError("Marks must be a number between 0 and 100.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateSubmission(selected.id, {
        status: "reviewed",
        marks: numericMarks,
        feedback: feedback.trim(),
        xpAwarded: Math.round((Number(selected.points || 0) * numericMarks) / 100),
        reviewedBy: firebaseUser.uid,
      }, selected.studentId);
      setSubmissions((items) => items.map((item) => item.id === selected.id ? { ...item, status: "reviewed", marks: numericMarks, feedback: feedback.trim(), xpAwarded: Math.round((Number(item.points || 0) * numericMarks) / 100) } : item));
      setSelected(null);
    } catch (err) {
      setError(err.message || "Could not save this review.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setTaskSuccess("");
    try {
      await createTask({ ...taskForm, createdBy: firebaseUser.uid });
      setTaskSuccess("Task created successfully. It is now visible on Extra Milers' dashboards.");
      setTaskForm(emptyTask);
      setTaskModalOpen(false);
    } catch (err) {
      setError(err.message || "Could not create this task.");
    } finally {
      setBusy(false);
    }
  }

  if (role !== "evaluator" && role !== "admin") return <div className="empty-role-state"><div className="empty-role-mark" aria-hidden="true" /><p className="app-kicker">NOT YOUR SPACE</p><h1>Nothing to evaluate here.</h1><p>This area is reserved for evaluators and admins.</p></div>;

  return <div className="evaluations-page">
    <div className="page-intro">
      <div><p className="app-kicker">EVALUATOR WORKSPACE</p><h1>Review the <span>work.</span></h1><p>Create missions, review submissions and turn feedback into meaningful progress.</p></div>
      <div className="evaluation-stats"><span><strong>{String(pending).padStart(2,"0")}</strong> pending</span><span><strong>{String(reviewed).padStart(2,"0")}</strong> reviewed</span></div>
    </div>

    <section className="panel" style={{padding:"22px 24px", marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between", gap:18}}>
      <div><p className="app-kicker">MISSION BUILDER</p><h2 style={{margin:"6px 0 4px"}}>Create a task for Extra Milers</h2><p style={{margin:0, color:"rgba(255,255,255,.55)", fontSize:11}}>New tasks automatically appear in Extra Milers' Tasks page and dashboard.</p></div>
      <button className="primary-app-button" type="button" onClick={() => { setTaskSuccess(""); setError(""); setTaskModalOpen(true); }}><Plus size={16}/> Create task</button>
    </section>

    {taskSuccess && <div className="submission-success" style={{marginBottom:18}}><CheckCircle2 size={18}/><div><strong>{taskSuccess}</strong></div></div>}

    <div className="task-toolbar"><div className="task-search"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search submissions..."/></div></div>
    {error&&<div className="login-error" role="alert">{error}</div>}
    {loading?<div className="panel loading-panel">Loading submissions…</div>:<section className="panel evaluation-table"><div className="evaluation-head"><span>EXTRA MILER</span><span>TASK</span><span>SUBMITTED</span><span>STATUS</span><span>SCORE</span></div>{filtered.map((s)=><div className="evaluation-row" key={s.id}><div className="eval-person"><span className="avatar">{(personByUid[s.studentId]?.name || "EM").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</span><div><strong>{personByUid[s.studentId]?.name || s.studentName || s.studentUserId || "Unknown member"}</strong><small>{s.studentUserId || personByUid[s.studentId]?.userId || ""}{s.teamName ? ` · ${s.teamName}` : ""}</small></div></div><span>{s.taskTitle || s.taskId}</span><span>{displayDate(s.submittedAt)}</span><span className={`eval-status ${s.status === "reviewed"?"reviewed":"pending"}`}>{s.status === "reviewed"?<CheckCircle2 size={14}/>:<Clock3 size={14}/>} {s.status === "reviewed"?"Reviewed":"Needs review"}</span><strong>{s.marks ?? "Not set"}</strong><button onClick={()=>openReview(s)} aria-label="Review submission"><ArrowRight size={15}/></button></div>)}{filtered.length===0&&<div className="loading-panel">No submissions match this search.</div>}</section>}
    <div className="evaluator-note"><UserRound size={17}/><span>Evaluator accounts can create tasks and review submissions. Admins have the same access.</span></div>

    {selected&&<div className="review-overlay" role="dialog" aria-modal="true"><div className="review-modal panel"><button className="review-close" onClick={()=>setSelected(null)} aria-label="Close"><X size={18}/></button><p className="app-kicker">REVIEW SUBMISSION</p><h2>{selected.taskTitle || selected.taskId}</h2><p className="review-person">{personByUid[selected.studentId]?.name || selected.studentName || selected.studentUserId} {selected.teamName ? `· ${selected.teamName}` : ""}</p>{(selected.fileUrl || selected.driveUrl) ? <a className="primary-app-button" href={selected.fileUrl || selected.driveUrl} target="_blank" rel="noreferrer">Open submitted file <ArrowRight size={15}/></a> : selected.fileName ? <div className="submission-success"><div><strong>Attached file</strong><p>{selected.fileName}</p></div></div> : null}<label>Marks out of 100<input type="number" min="0" max="100" value={marks} onChange={(e)=>setMarks(e.target.value)} /></label><label>Feedback<textarea rows="6" value={feedback} onChange={(e)=>setFeedback(e.target.value)} placeholder="What should they keep, change or try next?" /></label><button className="primary-app-button wide" disabled={busy} onClick={saveReview}>{busy?"Saving…":"Save evaluation"}<CheckCircle2 size={16}/></button></div></div>}

    {taskModalOpen&&<div className="review-overlay" role="dialog" aria-modal="true"><form className="review-modal panel" onSubmit={handleCreateTask}><button className="review-close" type="button" onClick={()=>setTaskModalOpen(false)} aria-label="Close"><X size={18}/></button><p className="app-kicker">MISSION BUILDER</p><h2>Create task</h2><p className="review-person">This task will immediately become visible to active Extra Milers.</p><label>Task title<input required value={taskForm.title} onChange={(e)=>setTaskForm({...taskForm,title:e.target.value})} placeholder="e.g. Define your problem" /></label><label>Chapter / stage<input value={taskForm.chapter} onChange={(e)=>setTaskForm({...taskForm,chapter:e.target.value})} placeholder="e.g. 01 · Discover" /></label><label>Description<textarea required rows="4" value={taskForm.description} onChange={(e)=>setTaskForm({...taskForm,description:e.target.value})} placeholder="What should the Extra Miler do?" /></label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>Deadline<input type="date" value={taskForm.deadline} onChange={(e)=>setTaskForm({...taskForm,deadline:e.target.value})} /></label><label>Points / XP<input type="number" min="0" value={taskForm.points} onChange={(e)=>setTaskForm({...taskForm,points:e.target.value})} /></label></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>Max marks<input type="number" min="1" value={taskForm.maxMarks} onChange={(e)=>setTaskForm({...taskForm,maxMarks:e.target.value})} /></label><label>Order<input type="number" min="1" value={taskForm.order} onChange={(e)=>setTaskForm({...taskForm,order:e.target.value})} /></label></div><label>Submission type<select value={taskForm.submissionType} onChange={(e)=>setTaskForm({...taskForm,submissionType:e.target.value})}><option value="file">File upload</option><option value="link">Link</option><option value="text">Text</option></select></label><button className="primary-app-button wide" disabled={busy} type="submit">{busy?"Creating…":"Create task"}<Plus size={16}/></button></form></div>}
  </div>;
}
