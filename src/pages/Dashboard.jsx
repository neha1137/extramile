import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Flame, Target, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { subscribeToActiveTasks, subscribeToLeaderboard, subscribeToMySubmissions, subscribeToPeople, subscribeToMentorRequests } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

function formatDue(value) {
  if (!value) return "No deadline";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function taskState(task, submissions) {
  const submission = submissions.find((item) => item.taskId === task.id);
  if (!submission) return { label: "Not started", progress: 0, submission: null };
  if (submission.status === "reviewed") return { label: "Completed", progress: 100, submission };
  return { label: "Submitted", progress: 0, submission };
}

function ExtraMilerDashboard() {
  const { profile, firebaseUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState({});

  useEffect(() => {
    let taskReady = false;
    let submissionsReady = false;
    let leaderboardReady = false;

    const finishLoading = () => {
      if (taskReady && submissionsReady && leaderboardReady) setLoading(false);
    };

    const markError = (key, error) => {
      console.error(`[Extra Mile] ${key} failed:`, error);
      setDataErrors((current) => ({ ...current, [key]: error?.message || "Could not load this section." }));
    };

    const unsubscribeTasks = subscribeToActiveTasks((items) => {
      setTasks(items);
      taskReady = true;
      finishLoading();
    }, (error) => {
      taskReady = true;
      markError("tasks", error);
      finishLoading();
    });

    const unsubscribeSubmissions = subscribeToMySubmissions(firebaseUser.uid, (items) => {
      setSubmissions(items);
      submissionsReady = true;
      finishLoading();
    }, (error) => {
      submissionsReady = true;
      markError("submissions", error);
      finishLoading();
    });

    const unsubscribeLeaderboard = subscribeToLeaderboard((items) => {
      setLeaderboard(items.filter((p) => p.role === "extra-miler"));
      leaderboardReady = true;
      finishLoading();
    }, (error) => {
      leaderboardReady = true;
      markError("leaderboard", error);
      finishLoading();
    });

    return () => {
      unsubscribeTasks();
      unsubscribeSubmissions();
      unsubscribeLeaderboard();
    };
  }, [firebaseUser.uid]);

  const states = useMemo(() => tasks.map((task) => ({ task, ...taskState(task, submissions) })), [tasks, submissions]);
  const completed = states.filter((item) => item.label === "Completed").length;
  const submitted = states.filter((item) => item.label === "Submitted").length;
  const total = tasks.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const currentRank = leaderboard.findIndex((p) => p.id === firebaseUser.uid);
  const upcoming = states.filter(({ task, label }) => label !== "Completed" && task.deadline).length;
  const visibleTasks = states.slice(0, 4);

  return <>
    <div className="page-intro dashboard-intro"><div><p className="app-kicker">YOUR EXTRA MILE</p><h1>Hey, {profile?.name?.split(" ")[0] || "there"} <span className="title-mark" aria-hidden="true" /></h1><p>Your dashboard reflects what you have actually done.</p></div><Link className="primary-app-button" to="/app/tasks">See my tasks <ArrowRight size={16}/></Link></div>
    <div className="fun-progress-banner"><div className="progress-copy"><p className="app-kicker">YOUR PROGRESS</p><h2>{total ? `${completed} of ${total} tasks completed.` : "Your journey starts here."}</h2><p>{total ? `${submitted} task${submitted === 1 ? " is" : "s are"} currently submitted for review.` : "Tasks added by your Extra Mile team will appear here automatically."}</p><div className="progress-line"><span style={{width:`${progress}%`}}/></div></div><div className="progress-orbit"><div className="progress-orbit-inner"><strong>{progress}%</strong><span>DONE</span></div></div><div className="streak"><Flame size={19}/><strong>{profile?.streak || 0}</strong><span>day streak</span></div></div>
    {Object.keys(dataErrors).length > 0 && (
      <div className="login-error" role="alert">
        <strong>Some dashboard data could not be loaded.</strong>
        {Object.entries(dataErrors).map(([key, message]) => (
          <div key={key}>{key}: {message}</div>
        ))}
      </div>
    )}
    <section className="dashboard-grid"><div className="panel tasks-panel playful-panel"><div className="panel-head"><div><p className="app-kicker">RIGHT NOW</p><h2>Your tasks</h2></div><Link to="/app/tasks">All tasks <ArrowRight size={14}/></Link></div><div className="task-list">{loading ? <div className="loading-panel">Loading tasks…</div> : visibleTasks.length === 0 ? <div className="loading-panel">{dataErrors.tasks ? "Tasks could not be loaded. See the Firebase error above." : "No tasks have been added yet. Tasks added by your Extra Mile team will appear here automatically."}</div> : visibleTasks.map(({task, label, progress: taskProgress},i)=><Link to={`/app/tasks/${task.id}`} className="task-row" key={task.id}><div className={`task-check ${label === "Completed" ? "done" : ""}`}>{label === "Completed"?<CheckCircle2 size={17}/>:<span>{i+1}</span>}</div><div className="task-main"><div className="task-meta"><span>{task.chapter || "EXTRA MILE"}</span><span><CalendarDays size={13}/>{formatDue(task.deadline)}</span></div><strong>{task.title}</strong><div className="mini-progress"><span style={{width:`${taskProgress}%`}}/></div></div><div className={`task-status ${label.toLowerCase().replace(" ","-")}`}>{label}</div><ArrowRight className="task-arrow" size={16}/></Link>)}</div></div>
      <div className="panel side-panel playful-panel"><div className="panel-head"><div><p className="app-kicker">YOUR NUMBERS</p><h2>At a glance</h2></div></div><div className="glance-item"><span className="glance-icon"><Target size={18}/></span><div><strong>{completed} / {total}</strong><small>Tasks complete</small></div></div><div className="glance-item"><span className="glance-icon"><Trophy size={18}/></span><div><strong>{currentRank >= 0 ? `#${currentRank + 1}` : "—"}</strong><small>Current leaderboard</small></div></div><div className="glance-item"><span className="glance-icon"><Users size={18}/></span><div><strong>0</strong><small>Mentor connections</small></div></div><div className="glance-item"><span className="glance-icon"><Clock3 size={18}/></span><div><strong>{upcoming}</strong><small>Upcoming deadlines</small></div></div></div></section>
    <section className="dashboard-lower"><div className="panel opportunity-mini playful-panel"><div><p className="app-kicker">OPPORTUNITY RADAR</p><h2>Go see what's happening.</h2><p>Hackathons, campus events, startup calls and things worth leaving your room for.</p></div><Link to="/app/opportunities" className="circle-arrow"><ArrowRight size={18}/></Link></div><div className="panel announcement-mini playful-panel"><p className="app-kicker">UPDATES</p><h3>No dummy announcements.</h3><p>Important updates will appear in Notifications when they are created for you.</p><Link to="/app/notifications">Open notifications <ArrowRight size={14}/></Link></div></section>
  </>;
}

function MentorDashboard() {
  const { firebaseUser } = useAuth();
  const [people, setPeople] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let peopleReady = false;
    let requestsReady = false;
    const finish = () => { if (peopleReady && requestsReady) setLoading(false); };

    const unsubscribePeople = subscribeToPeople(
      (items) => {
        setPeople(items.filter((person) => person.role === "extra-miler"));
        peopleReady = true;
        finish();
      },
      (err) => {
        console.error("[Extra Mile] Mentor dashboard people failed:", err);
        setError(err?.message || "Could not load Extra Miler profiles.");
        peopleReady = true;
        finish();
      }
    );

    const unsubscribeRequests = subscribeToMentorRequests(
      firebaseUser.uid,
      (items) => {
        setRequests(items);
        requestsReady = true;
        finish();
      },
      (err) => {
        console.error("[Extra Mile] Mentor dashboard requests failed:", err);
        setError(err?.message || "Could not load mentorship requests.");
        requestsReady = true;
        finish();
      }
    );

    return () => {
      unsubscribePeople();
      unsubscribeRequests();
    };
  }, [firebaseUser.uid]);

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const recentPeople = people.slice(0, 3);

  return <>
    <div className="page-intro dashboard-intro">
      <div>
        <p className="app-kicker">MENTOR SPACE</p>
        <h1>Ready to help someone <span>move?</span></h1>
        <p>Real Extra Milers, real requests and real conversations — all in one place.</p>
      </div>
      <Link className="primary-app-button" to="/app/mentors">
        {pendingRequests.length ? `${pendingRequests.length} request${pendingRequests.length === 1 ? "" : "s"} waiting` : "Open mentorship"} <ArrowRight size={16}/>
      </Link>
    </div>

    {error && <div className="login-error" role="alert">Some mentor data could not be loaded: {error}</div>}

    <section className="role-hero mentor-hero">
      <div>
        <span className="role-hero-mark" aria-hidden="true" />
        <p className="app-kicker">YOUR COMMUNITY</p>
        <h2>{loading ? "Loading your community." : `${people.length} Extra Miler${people.length === 1 ? "" : "s"} in your view.`}</h2>
        <p>Explore their real profiles and respond when someone asks for your guidance.</p>
        <Link to="/app/people" className="primary-app-button">See people <ArrowRight size={16}/></Link>
      </div>
      <div className="role-hero-art">
        <span className="hero-art-ring" />
        <span className="hero-art-dot dot-a" />
        <span className="hero-art-dot dot-b" />
        <span className="hero-art-dot dot-c" />
      </div>
    </section>

    <div className="role-card-grid mentor-real-stats">
      <Link to="/app/people" className="panel mentor-stat-card">
        <p className="app-kicker">EXTRA MILERS</p>
        <h3>{loading ? "—" : people.length}</h3>
        <p>Active Extra Miler profiles visible to you.</p>
        <span>Explore profiles <ArrowRight size={13}/></span>
      </Link>
      <Link to="/app/mentors" className="panel mentor-stat-card">
        <p className="app-kicker">REQUESTS</p>
        <h3>{loading ? "—" : pendingRequests.length}</h3>
        <p>{pendingRequests.length ? "Pending mentorship conversations." : "No pending mentorship requests."}</p>
        <span>Open requests <ArrowRight size={13}/></span>
      </Link>
      <div className="panel mentor-stat-card">
        <p className="app-kicker">DECISIONS</p>
        <h3>{loading ? "—" : requests.filter((request) => request.status !== "pending").length}</h3>
        <p>Requests you have already responded to.</p>
      </div>
    </div>

    <section className="dashboard-lower">
      <div className="panel mentor-recent-panel">
        <div className="panel-head">
          <div><p className="app-kicker">RECENT EXTRA MILERS</p><h2>{loading ? "Loading profiles…" : recentPeople.length ? "People in your community." : "No Extra Milers yet."}</h2></div>
          <Link to="/app/people">View all <ArrowRight size={14}/></Link>
        </div>
        {recentPeople.length ? (
          <div className="mentor-recent-list">
            {recentPeople.map((person) => (
              <div className="mentor-recent-person" key={person.id}>
                <span className="mentor-recent-avatar">{(person.name || person.userId || "EM").split(" ").filter(Boolean).slice(0,2).map((x)=>x[0]).join("").toUpperCase()}</span>
                <div><strong>{person.name || person.userId}</strong><span>{[person.year, person.department].filter(Boolean).join(" · ") || "Profile details not added"}</span>{person.skills?.length ? <small>{person.skills.slice(0,3).join(" · ")}</small> : null}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mentor-dashboard-empty">No active Extra Miler profiles are visible yet.</div>
        )}
      </div>

      <div className="panel announcement-mini playful-panel">
        <p className="app-kicker">MENTORSHIP</p>
        <h3>{pendingRequests.length ? `${pendingRequests.length} request${pendingRequests.length === 1 ? "" : "s"} need${pendingRequests.length === 1 ? "s" : ""} your attention.` : "No pending requests."}</h3>
        <p>{pendingRequests.length ? "Open Mentorship to read each student's message and accept or decline the conversation." : "When an Extra Miler requests your guidance, it will appear here automatically."}</p>
        <Link to="/app/mentors">Open mentorship <ArrowRight size={14}/></Link>
      </div>
    </section>
  </>;
}
function EvaluatorDashboard() { return <><div className="page-intro dashboard-intro"><div><p className="app-kicker">EVALUATOR SPACE</p><h1>Let's make feedback <span>count.</span></h1><p>Quick reviews, clear feedback and better next steps for every Extra Miler.</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className="primary-app-button" to="/app/evaluations">Open submissions <ArrowRight size={16}/></Link><Link className="secondary-app-button" to="/app/evaluations">Create a task <ArrowRight size={16}/></Link></div></div><section className="role-hero evaluator-hero"><div><span className="role-hero-mark evaluator-mark" aria-hidden="true" /><p className="app-kicker">REVIEW QUEUE</p><h2>Review the submissions that actually exist.</h2><p>New work appears here when Extra Milers submit it.</p><Link to="/app/evaluations" className="primary-app-button">Start reviewing <ArrowRight size={16}/></Link></div><div className="role-hero-art">→<br/><small>SUBMISSIONS</small></div></section></> }

function AdminDashboard(){
  const { firebaseUser } = useAuth();
  const [status,setStatus]=useState({connected:false,email:"",folder:null});
  const [folders,setFolders]=useState([]);
  const [showFolders,setShowFolders]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [newFolder,setNewFolder]=useState("Extra Miler Submissions");
  const [member,setMember]=useState({email:"",name:"",role:"extra-miler"});

  async function api(path,options={}){
    const token=await firebaseUser.getIdToken();
    const r=await fetch(path,{...options,headers:{...(options.headers||{}),Authorization:`Bearer ${token}`}});
    const raw=await r.text();
    let data={};
    try{data=raw?JSON.parse(raw):{}}catch{throw new Error(`Server returned an invalid response (HTTP ${r.status}).`)}
    if(!r.ok)throw new Error(data.error||`Request failed (HTTP ${r.status}).`);
    return data;
  }
  async function load(){try{const s=await api("/api/google/status");setStatus(s);}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[]);
  async function connect(){try{setBusy(true);setError("");const d=await api("/api/google/auth-url");window.location.href=d.url;}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function openFolders(){try{setError("");const d=await api("/api/google/folders");setFolders(d.folders||[]);setShowFolders(true);}catch(e){setError(e.message)}}
  async function chooseFolder(folderId){try{setBusy(true);const d=await api("/api/google/folder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderId})});setStatus(s=>({...s,folder:d.folder}));setShowFolders(false);setMessage("Submission folder saved.");}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function createFolder(){try{setBusy(true);const d=await api("/api/google/folder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:newFolder})});setStatus(s=>({...s,folder:d.folder}));setShowFolders(false);setMessage("Submission folder created and selected.");}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function createMember(e){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{
      const result=await api("/api/admin/create-member",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(member)});
      setMessage(`Created ${result.user.name} · ${result.user.userId} (${result.user.email}) as ${result.user.role}. Share the configured starter password with them separately; they can change it from the login page.`);
      setMember({email:"",name:"",role:"extra-miler"});
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <div className="dashboard-page">
    <div className="page-intro"><div><p className="app-kicker">ADMIN CONTROL ROOM</p><h1>Run the <span>Extra Mile.</span></h1><p>Manage member access, program storage, submissions and opportunities.</p></div></div>
    {error&&<div className="login-error" role="alert">{error}</div>}
    {message&&<div className="submission-success"><CheckCircle2 size={17}/><div>{message}</div></div>}

    <section className="panel" style={{padding:28,marginBottom:22}}>
      <p className="app-kicker">MEMBER ACCESS</p><h2 style={{margin:"8px 0 6px"}}>Create a member account</h2>
      <p style={{color:"#8589a7",fontSize:12,lineHeight:1.6}}>Enter the person's real email, name and role. Extra Mile creates their Firebase login and profile automatically, and generates a unique member ID. Give them the configured starter password separately; they can change it from the login page.</p>
      <form onSubmit={createMember} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:20}}>
        <label style={{display:"grid",gap:7,fontSize:12,color:"#b8bad0"}}>Email address<input type="email" required value={member.email} onChange={e=>setMember(m=>({...m,email:e.target.value}))} placeholder="person@gmail.com" autoComplete="email" /></label>
        <label style={{display:"grid",gap:7,fontSize:12,color:"#b8bad0"}}>Full name<input required value={member.name} onChange={e=>setMember(m=>({...m,name:e.target.value}))} placeholder="Full name" autoComplete="name" /></label>
        <label style={{display:"grid",gap:7,fontSize:12,color:"#b8bad0"}}>Role<select value={member.role} onChange={e=>setMember(m=>({...m,role:e.target.value}))}><option value="extra-miler">Extra Miler</option><option value="mentor">Mentor</option><option value="evaluator">Evaluator</option><option value="admin">Admin</option></select></label>
        <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><button className="primary-app-button" type="submit" disabled={busy}>{busy?"Creating account…":"Create account"} <ArrowRight size={15}/></button><span style={{fontSize:11,color:"#777c98"}}>IDs are generated automatically (EM, M, EV or AD). Evaluators and admins stay hidden from the public People page.</span></div>
      </form>
    </section>

    <section className="panel" style={{padding:28,marginBottom:22}}><p className="app-kicker">SUBMISSION STORAGE</p><h2 style={{margin:"8px 0 6px"}}>Google Drive</h2><p style={{color:"#8589a7",fontSize:12,lineHeight:1.6}}>Connect the one Google account that owns the program's submission files. Students and evaluators do not connect their own Drive accounts.</p><div style={{marginTop:20,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>{status.connected?<span className="task-status completed">CONNECTED {status.email?`· ${status.email}`:""}</span>:<span className="task-status">NOT CONNECTED</span>}<button className="primary-app-button" onClick={connect} disabled={busy}>{busy?"Opening Google…":"Connect Google Drive"}</button>{status.connected&&<button className="ghost-app-button" onClick={openFolders}>Choose submission folder</button>}</div>{status.connected&&<div style={{marginTop:18,padding:16,border:"1px solid var(--app-line)",background:"rgba(255,255,255,.02)"}}><p className="app-kicker">CURRENT SUBMISSION FOLDER</p><strong>{status.folder?.name||"Not selected yet"}</strong>{status.folder?.webViewLink&&<a href={status.folder.webViewLink} target="_blank" rel="noreferrer" style={{display:"block",marginTop:7,color:"#b8a5ff",fontSize:10}}>Open folder ↗</a>}<p style={{color:"#707590",fontSize:10,marginTop:7}}>All student uploads will be organized automatically inside this folder.</p></div>}</section>

    <section className="panel" style={{padding:28}}><p className="app-kicker">OPPORTUNITY RADAR</p><h2 style={{margin:"8px 0 6px"}}>Unstop</h2><p style={{color:"#8589a7",fontSize:12,lineHeight:1.6}}>Go to Opportunities to paste an Unstop link, review the details and publish it for the community.</p><Link to="/app/opportunities" className="primary-app-button" style={{display:"inline-flex",marginTop:16}}>Manage opportunities <ArrowRight size={15}/></Link></section>

    {showFolders&&<div className="review-overlay" role="dialog" aria-modal="true"><div className="panel unstop-preview-modal"><button className="review-close" onClick={()=>setShowFolders(false)} aria-label="Close">×</button><p className="app-kicker">GOOGLE DRIVE</p><h2>Choose submission folder</h2><p style={{color:"#8589a7",fontSize:11}}>Pick an existing Drive folder or create a new root folder.</p><div style={{display:"flex",gap:8,margin:"18px 0"}}><input value={newFolder} onChange={e=>setNewFolder(e.target.value)} placeholder="Folder name" style={{flex:1}}/><button className="primary-app-button" onClick={createFolder} disabled={busy}>Create & use</button></div><div style={{display:"grid",gap:8,maxHeight:320,overflow:"auto"}}>{folders.map(f=><button key={f.id} className="ghost-app-button" style={{justifyContent:"flex-start"}} onClick={()=>chooseFolder(f.id)}><strong>{f.name}</strong></button>)}</div></div></div>}
  </div>
}

export default function Dashboard() { const { role } = useAuth(); if (role === "admin") return <AdminDashboard/>; if (role === "mentor") return <div className="dashboard-page"><MentorDashboard/></div>; if (role === "evaluator") return <div className="dashboard-page"><EvaluatorDashboard/></div>; return <div className="dashboard-page"><ExtraMilerDashboard/></div>; }
