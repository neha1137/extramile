import { Bell, CheckCircle2, MessageCircle, Trophy, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { subscribeToMyNotifications } from "../firebase/firestore";

const iconFor = (type) => type === "evaluation" ? CheckCircle2 : type === "mentor" || type === "mentor_request" || type === "mentor_response" ? UserRound : type === "leaderboard" ? Trophy : type === "message" ? MessageCircle : Bell;

function displayTime(value) {
  if (!value) return "Just now";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Notifications() {
  const { role, firebaseUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseUser?.uid) return undefined;
    setLoading(true);
    return subscribeToMyNotifications(firebaseUser.uid, (items) => { setNotes(items); setLoading(false); }, (err) => { console.error(err); setError("Notifications could not be loaded."); setLoading(false); });
  }, [firebaseUser?.uid]);

  const unread = notes.filter((note) => !note.read).length;
  const description = role === "mentor" ? "Mentorship updates and requests created for you." : role === "evaluator" ? "Evaluator activity and updates created for you." : "Important updates created for you by the Extra Mile system.";

  return <div className="notifications-page"><div className="page-intro"><div><p className="app-kicker">YOUR INBOX</p><h1>Stay in the <span>loop.</span></h1><p>{description}</p></div>{unread > 0 && <span className="unread-count">{unread} unread</span>}</div>{error&&<div className="login-error">{error}</div>}<section className="panel notification-list">{loading?<div className="loading-panel">Listening for updates…</div>:notes.length===0?<div className="loading-panel">No notifications yet. You'll see updates here when something happens.</div>:notes.map((n)=><div className={`notification-row ${!n.read ? "unread" : ""}`} key={n.id}>{(() => { const Icon=iconFor(n.type); return <div className="notification-icon"><Icon size={18}/></div>; })()}<div><strong>{n.title || "Update"}</strong><p>{n.body || "You have a new update."}</p><small>{displayTime(n.createdAt)}</small></div>{!n.read&&<span className="unread-dot"/>}</div>)}</section></div>;
}
