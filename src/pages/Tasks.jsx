import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Circle, Clock3, Filter, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { subscribeToActiveTasks, subscribeToMySubmissions } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

function formatDue(value) {
  if (!value) return "No deadline";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Tasks() {
  const { firebaseUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let tasksReady = false;
    let submissionsReady = false;

    const finishLoading = () => {
      if (tasksReady && submissionsReady) setLoading(false);
    };

    const unsubscribeTasks = subscribeToActiveTasks((items) => {
      setTasks(items);
      tasksReady = true;
      finishLoading();
    }, (err) => {
      console.error("[Extra Mile] Tasks failed:", err);
      setError(`Tasks could not be loaded: ${err?.message || "Unknown Firebase error"}`);
      tasksReady = true;
      finishLoading();
    });

    const unsubscribeSubmissions = subscribeToMySubmissions(firebaseUser.uid, (items) => {
      setSubmissions(items);
      submissionsReady = true;
      finishLoading();
    }, (err) => {
      console.error("[Extra Mile] Submissions failed:", err);
      setError((current) => current || `Your submissions could not be loaded: ${err?.message || "Unknown Firebase error"}`);
      submissionsReady = true;
      finishLoading();
    });

    return () => {
      unsubscribeTasks();
      unsubscribeSubmissions();
    };
  }, [firebaseUser.uid]);

  const filtered = useMemo(() => tasks.filter((task) => `${task.title} ${task.chapter} ${task.description}`.toLowerCase().includes(search.toLowerCase())), [tasks, search]);
  const points = submissions.reduce((sum, item) => sum + Number(item.xpAwarded || 0), 0);

  return <div className="tasks-page">
    <div className="page-intro"><div><p className="app-kicker">YOUR MISSIONS</p><h1>The work <span>matters.</span></h1><p>Every task is a small move toward something bigger.</p></div><div className="task-total"><strong>{points}</strong><span>points from reviews</span></div></div>
    <div className="task-toolbar"><div className="task-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..."/></div><button type="button"><Filter size={15}/> All chapters</button></div>
    {error && <div className="login-error" role="alert">{error}</div>}
    {loading ? <div className="panel loading-panel">Loading your missions…</div> : filtered.length === 0 ? <div className="panel loading-panel">No active tasks found yet. Your Extra Mile admin can add tasks in Firestore.</div> : <div className="task-page-list">{filtered.map((task) => {
      const submission = submissions.find((item) => item.taskId === task.id);
      const progress = submission?.status === "reviewed" ? 100 : 0;
      const status = submission ? (submission.status === "reviewed" ? "Completed" : "Submitted") : "Not started";
      return <Link to={`/app/tasks/${task.id}`} className="task-card panel" key={task.id}><div className={`task-state-icon ${progress===100?'complete':''}`}>{progress===100?<CheckCircle2 size={22}/>:progress>0?<Clock3 size={21}/>:<Circle size={21}/>}</div><div className="task-card-main"><div className="task-card-meta"><span>{task.chapter || "EXTRA MILE"}</span><span><CalendarDays size={13}/> Due {formatDue(task.deadline || task.due)}</span></div><h2>{task.title}</h2><p>{task.description}</p><div className="task-card-progress"><div><span>Progress</span><strong>{progress}%</strong></div><div className="mini-progress"><span style={{width:`${progress}%`}}/></div></div></div><div className="task-card-side"><span className={`task-status ${status.toLowerCase().replace(" ","-")}`}>{status}</span><strong>+{task.points || task.xp || 0}</strong><ArrowRight size={17}/></div></Link>;
    })}</div>}
  </div>;
}
