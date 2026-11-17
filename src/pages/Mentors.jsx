import { ArrowRight, Check, MessageCircle, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { respondToMentorshipRequest, subscribeToMentorRequests, subscribeToMentors } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

function initials(name = "Mentor") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}

function timeLabel(value) {
  if (!value) return "";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function Mentors() {
  const { firebaseUser, role } = useAuth();
  const [requests, setRequests] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let requestReady = false;
    let mentorsReady = role !== "admin";
    const finish = () => { if (requestReady && mentorsReady) setLoading(false); };

    const unsubRequests = subscribeToMentorRequests(firebaseUser.uid, (items) => {
      setRequests(items);
      requestReady = true;
      finish();
    }, (err) => {
      setError(`Requests: ${err?.message || "Could not load mentorship requests."}`);
      requestReady = true;
      finish();
    });

    const unsubMentors = role === "admin"
      ? subscribeToMentors((items) => {
          setMentors(items);
          mentorsReady = true;
          finish();
        }, (err) => {
          setError(`Mentors: ${err?.message || "Could not load mentor profiles."}`);
          mentorsReady = true;
          finish();
        })
      : () => {};

    return () => {
      unsubRequests();
      unsubMentors();
    };
  }, [firebaseUser.uid, role]);

  const pending = requests.filter((request) => request.status === "pending");
  const accepted = requests.filter((request) => request.status === "accepted");
  const handled = requests.filter((request) => request.status === "declined");

  const filteredMentors = useMemo(() => mentors.filter((mentor) => {
    const text = `${mentor.name || ""} ${mentor.department || ""} ${mentor.year || ""} ${mentor.startupType || ""} ${(mentor.skills || []).join(" ")}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [mentors, search]);

  async function handleRequest(requestId, status) {
    setBusy(requestId);
    setError("");
    try {
      await respondToMentorshipRequest(requestId, status);
    } catch (err) {
      setError(err.message || "Could not update the request.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mentors-page">
      <div className="page-intro mentor-page-intro">
        <div>
          <p className="app-kicker">MENTORSHIP / YOUR SPACE</p>
          <h1>Help someone go <span>further.</span></h1>
          <p>Real requests from real Extra Milers. Accept the conversations where your experience can be useful.</p>
        </div>
        <div className="mentor-page-summary">
          <span><strong>{pending.length}</strong> waiting</span>
          <span><strong>{accepted.length}</strong> active</span>
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <section className="mentor-request-panel panel mentor-main-panel">
        <div className="panel-head">
          <div>
            <p className="app-kicker">CONVERSATION REQUESTS</p>
            <h2>Students reaching out</h2>
          </div>
          <span className="request-count">{loading ? "Loading…" : `${pending.length} waiting`}</span>
        </div>

        {loading ? (
          <div className="loading-panel">Listening for mentorship requests…</div>
        ) : pending.length === 0 ? (
          <div className="mentor-empty-state mentor-empty-large">
            <div className="mentor-empty-icon"><MessageCircle size={21}/></div>
            <div><strong>No pending requests.</strong><span>When an Extra Miler requests your guidance, the request will appear here automatically and you'll receive a notification.</span></div>
          </div>
        ) : (
          <div className="mentor-request-list">
            {pending.map((request) => (
              <article className="mentor-request-row mentor-request-row-rich" key={request.id}>
                <span className="mentor-request-avatar">{initials(request.studentName)}</span>
                <div className="mentor-request-copy">
                  <div className="mentor-request-name-line"><strong>{request.studentName || "Extra Miler"}</strong><small>{timeLabel(request.createdAt)}</small></div>
                  <span>{request.message || "No message was added."}</span>
                </div>
                <div className="request-actions">
                  <button className="request-decline" disabled={busy === request.id} onClick={() => handleRequest(request.id, "declined")} aria-label={`Decline ${request.studentName}`}><X size={15}/></button>
                  <button className="request-accept" disabled={busy === request.id} onClick={() => handleRequest(request.id, "accepted")}>{busy === request.id ? "Saving…" : "Accept conversation"} <ArrowRight size={14}/></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mentor-mentee-panel panel">
        <div className="panel-head">
          <div><p className="app-kicker">MY MENTEES</p><h2>Active mentorships</h2></div>
          <span className="request-count">{accepted.length}</span>
        </div>
        {accepted.length === 0 ? (
          <div className="mentor-empty-state"><UserRound size={20}/><div><strong>No active mentees yet.</strong><span>Accepted mentorship requests will appear here. Nothing is being invented while the list is empty.</span></div></div>
        ) : (
          <div className="mentor-mentee-grid">
            {accepted.map((request) => (
              <article className="mentor-mentee-card" key={request.id}>
                <span className="mentor-request-avatar">{initials(request.studentName)}</span>
                <div><p className="app-kicker">EXTRA MILER</p><h3>{request.studentName || "Extra Miler"}</h3><span>Connected {timeLabel(request.respondedAt)}</span></div>
                <span className="request-status accepted"><Check size={13}/> Active</span>
              </article>
            ))}
          </div>
        )}
      </section>

      {handled.length > 0 && (
        <section className="mentor-history panel">
          <div className="panel-head"><div><p className="app-kicker">REQUEST HISTORY</p><h2>Past decisions</h2></div></div>
          {handled.map((request) => (
            <div className="mentor-history-row" key={request.id}>
              <span>{request.studentName || "Extra Miler"}</span>
              <span>{timeLabel(request.respondedAt)}</span>
              <strong className="request-status declined"><X size={13}/> Declined</strong>
            </div>
          ))}
        </section>
      )}

      {role === "admin" && (
        <section className="mentor-admin-directory">
          <div className="mentor-section-heading">
            <div><p className="app-kicker">MENTOR DIRECTORY</p><h2>Mentors who are open to requests.</h2></div>
            <div className="task-search mentor-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mentors..."/></div>
          </div>
          {filteredMentors.length === 0 ? (
            <div className="mentor-empty-state panel"><UserRound size={20}/><div><strong>No mentor profiles match.</strong><span>Only active mentor profiles are shown here.</span></div></div>
          ) : (
            <div className="mentor-grid">
              {filteredMentors.map((mentor) => (
                <article className="panel mentor-card" key={mentor.id}>
                  <div className="mentor-card-top"><span className="mentor-avatar">{mentor.avatarDataUrl ? <img src={mentor.avatarDataUrl} alt="" /> : mentor.avatarEmoji ? mentor.avatarEmoji : initials(mentor.name || mentor.userId)}</span><span className="mentor-year">{mentor.year || "Mentor"}</span></div>
                  <h2>{mentor.name || mentor.userId}</h2>
                  <p>{[mentor.department, mentor.startupType].filter(Boolean).join(" · ") || "Mentor profile"}</p>
                  {mentor.bio && <div className="mentor-focus"><span>BIO</span><strong>{mentor.bio}</strong></div>}
                  {mentor.skills?.length > 0 && <div className="person-skills">{mentor.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div>}
                  <div className="mentor-profile-link"><UserRound size={14}/> {mentor.acceptingMentorshipRequests ? "Open to requests" : "Requests closed"}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
