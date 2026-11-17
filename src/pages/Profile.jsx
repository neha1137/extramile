import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Edit3, Plus, Save, Send, UserRound, X } from "lucide-react";
import { useAuth } from "../context/useAuth";
import {
  createMentorshipRequest,
  subscribeToMentors,
  subscribeToMyMentorshipRequests,
  updateUserProfile,
} from "../firebase/firestore";

function initials(name = "Extra Miler") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}

function requestLabel(status) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  return "Requested";
}

export default function Profile() {
  const { profile, firebaseUser, role, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", department: "", year: "", startupType: "", teamName: "",
    bio: "", skills: [], interests: [], acceptingMentorshipRequests: false, avatarDataUrl: "", avatarEmoji: "",
  });
  const [newSkill, setNewSkill] = useState("");
  const [toast, setToast] = useState("");
  const avatarInputRef = useRef(null);

  const [mentors, setMentors] = useState([]);
  const [mentorRequests, setMentorRequests] = useState([]);
  const [mentorError, setMentorError] = useState("");
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requesting, setRequesting] = useState(false);

  const isMentor = role === "mentor";
  const isEvaluator = role === "evaluator";
  const isExtraMiler = role === "extra-miler";

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
      department: profile.department || "",
      year: profile.year || "",
      startupType: profile.startupType || "",
      teamName: profile.teamName || "",
      bio: profile.bio || "",
      skills: Array.isArray(profile.skills) ? profile.skills : [],
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      acceptingMentorshipRequests: profile.acceptingMentorshipRequests === true,
      avatarDataUrl: profile.avatarDataUrl || "",
      avatarEmoji: profile.avatarEmoji || "",
    });
  }, [profile]);

  useEffect(() => {
    if (!isExtraMiler) return undefined;
    const unsubMentors = subscribeToMentors(
      (items) => setMentors(items.filter((mentor) => mentor.acceptingMentorshipRequests === true)),
      (err) => setMentorError(err?.message || "Could not load mentors.")
    );
    const unsubRequests = subscribeToMyMentorshipRequests(
      firebaseUser.uid,
      setMentorRequests,
      (err) => setMentorError(err?.message || "Could not load mentorship requests.")
    );
    return () => {
      unsubMentors();
      unsubRequests();
    };
  }, [isExtraMiler, firebaseUser.uid]);

  const requestStateByMentor = useMemo(() => {
    const map = new Map();
    mentorRequests.forEach((request) => {
      const current = map.get(request.mentorId) || { pending: 0, accepted: false };
      if (request.status === "pending") current.pending += 1;
      if (request.status === "accepted") current.accepted = true;
      map.set(request.mentorId, current);
    });
    return map;
  }, [mentorRequests]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const addSkill = () => {
    const value = newSkill.trim();
    if (!value || form.skills.includes(value)) return;
    setField("skills", [...form.skills, value]);
    setNewSkill("");
  };

  async function saveProfile() {
    setSaving(true);
    setError("");
    try {
      await updateUserProfile(firebaseUser.uid, {
        name: form.name.trim(),
        department: form.department,
        year: form.year,
        startupType: form.startupType.trim(),
        teamName: form.teamName.trim(),
        bio: form.bio.trim(),
        skills: form.skills,
        interests: form.interests,
        ...(isMentor ? { acceptingMentorshipRequests: form.acceptingMentorshipRequests === true } : {}),
        avatarDataUrl: form.avatarDataUrl || "",
        avatarEmoji: form.avatarEmoji || "",
      });
      await refreshProfile();
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function sendMentorshipRequest() {
    if (!selectedMentor) return;
    setRequesting(true);
    setMentorError("");
    try {
      const result = await createMentorshipRequest({
        studentId: firebaseUser.uid,
        studentName: profile?.name || profile?.userId || "Extra Miler",
        mentorId: selectedMentor.id,
        mentorName: selectedMentor.name || selectedMentor.userId || "Mentor",
        message: requestMessage,
      });
      setRequestMessage("");
      setToast(result.updated ? "Your mentorship request was updated and sent." : "Mentorship request sent. The mentor has been notified.");
      setTimeout(() => setToast(""), 2600);
    } catch (err) {
      if (err.code === "MENTOR_REQUEST_DUPLICATE") {
        setToast("You already sent this exact message. Try a different message.");
        setTimeout(() => setToast(""), 3200);
      } else if (err.code === "MENTOR_REQUEST_ALREADY_CONNECTED") {
        setToast("You are already connected with this mentor.");
        setTimeout(() => setToast(""), 3200);
      } else {
        setMentorError(err.message || "Could not send the mentorship request.");
      }
    } finally {
      setRequesting(false);
    }
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const size = 320;
            const canvas = document.createElement("canvas");
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext("2d");
            const scale = Math.max(size / img.width, size / img.height);
            const w = img.width * scale, h = img.height * scale;
            ctx.drawImage(img, (size-w)/2, (size-h)/2, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.78));
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setField("avatarDataUrl", data);
      setField("avatarEmoji", "");
    } catch { setError("Could not process that image."); }
  }

  const roleTitle = isMentor ? "MENTOR" : isEvaluator ? "EVALUATOR" : role === "admin" ? "ADMIN" : "EXTRA MILER";
  const description = isMentor
    ? "Help people move ideas forward with perspective, experience and the right questions."
    : isEvaluator
      ? "A clear profile helps builders understand the perspective behind your feedback."
      : "Tell the ecosystem what you are building and what you bring to the table.";

  return (
    <div className="profile-page">
      <div className="page-intro">
        <div>
          <p className="app-kicker">IDENTITY / PROFILE</p>
          <h1>Your <span>profile.</span></h1>
          <p>{description}</p>
        </div>
        <button className="primary-app-button" disabled={saving} onClick={() => editing ? saveProfile() : setEditing(true)}>
          {editing ? <><Save size={16}/> {saving ? "Saving…" : "Save profile"}</> : <><Edit3 size={16}/> Edit profile</>}
        </button>
      </div>

      <div className="profile-layout">
        <aside className="profile-card panel">
          <button type="button" className="profile-avatar-large avatar-picker" onClick={() => editing && avatarInputRef.current?.click()} title={editing ? "Choose a photo or emoji" : "Profile avatar"}>
            {form.avatarDataUrl ? <img src={form.avatarDataUrl} alt="Profile" /> : form.avatarEmoji ? <span className="avatar-emoji-large">{form.avatarEmoji}</span> : initials(profile?.name)}
            {editing && <span className="avatar-edit-hint">EDIT</span>}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} hidden />
          {editing && <div className="avatar-options"><span>Choose a vibe</span>{["🚀","💡","🪐","🌱","🦋","⚡","🎨","🧠"].map((emoji)=><button key={emoji} type="button" className={form.avatarEmoji===emoji?"active":""} onClick={()=>{setField("avatarEmoji",emoji);setField("avatarDataUrl","")}}>{emoji}</button>)}</div>}
          <h2>{profile?.name || "Extra Miler"}</h2>
          <p>{profile?.bio || "Your profile is ready for you."}</p>
          <span className="profile-role">{roleTitle} · {profile?.year || "MEMBER"}</span>
          <div className="profile-divider"/>
          <div className="profile-stat"><strong>{profile?.xp || 0}</strong><span>points on profile</span></div>
          <div className="profile-stat"><strong>{profile?.interests?.length || 0}</strong><span>interests</span></div>
        </aside>

        <section className="panel profile-form-card">
          <div className="profile-section-head">
            <div><p className="app-kicker">ABOUT YOU</p><h2>Make it yours.</h2></div>
          </div>

          <div className="form-grid">
            <label>Full name<input disabled={!editing} value={form.name} onChange={(e)=>setField("name",e.target.value)} /></label>
            <label>Department<select disabled={!editing} value={form.department} onChange={(e)=>setField("department",e.target.value)}>
              <option value="">Choose</option><option>Computer Science</option><option>Information Science</option><option>Electronics</option><option>Mechanical</option><option>Business / Management</option><option>Other</option>
            </select></label>
            <label>Year<select disabled={!editing} value={form.year} onChange={(e)=>setField("year",e.target.value)}>
              <option value="">Choose</option><option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
            </select></label>
            <label>{isMentor ? "Mentorship focus" : "Startup type"}<input disabled={!editing} value={form.startupType} onChange={(e)=>setField("startupType",e.target.value)} placeholder="e.g. Technology" /></label>
            <label>Team name<input disabled={!editing} value={form.teamName} onChange={(e)=>setField("teamName",e.target.value)} placeholder="e.g. Team Alpha" /></label>
          </div>

          <label className="full-field">Short bio<textarea disabled={!editing} value={form.bio} onChange={(e)=>setField("bio",e.target.value)} /></label>

          {isMentor && (
            <div className="mentor-profile-settings">
              <div>
                <p className="app-kicker">MENTORSHIP</p>
                <h3>Let Extra Milers request your guidance</h3>
                <p>Turn this on when you are available for new mentorship conversations.</p>
              </div>
              <button
                type="button"
                className={`availability-toggle ${form.acceptingMentorshipRequests ? "is-on" : ""}`}
                onClick={() => editing && setField("acceptingMentorshipRequests", !form.acceptingMentorshipRequests)}
                disabled={!editing}
                aria-pressed={form.acceptingMentorshipRequests}
              >
                <span className="toggle-knob" />
                {form.acceptingMentorshipRequests ? "Open to requests" : "Requests closed"}
              </button>
            </div>
          )}

          {isExtraMiler && (
            <section className="mentor-discovery-section">
              <div className="profile-subsection-heading">
                <div><p className="app-kicker">MENTORSHIP</p><h3>Find your mentor.</h3><p>Choose a mentor who has opened requests and start a conversation.</p></div>
              </div>

              {mentorError && <div className="login-error">{mentorError}</div>}

              {mentors.length === 0 ? (
                <div className="empty-mentor-state">
                  <UserRound size={20}/>
                  <div><strong>No mentors are open to requests yet.</strong><span>Mentors will appear here when they turn on mentorship requests.</span></div>
                </div>
              ) : (
                <div className="profile-mentor-grid">
                  {mentors.map((mentor) => {
                    const requestState = requestStateByMentor.get(mentor.id) || { pending: 0, accepted: false };
                    return (
                      <article className="profile-mentor-card" key={mentor.id}>
                        <div className="profile-mentor-avatar">{initials(mentor.name || mentor.userId)}</div>
                        <div className="profile-mentor-copy">
                          <strong>{mentor.name || mentor.userId}</strong>
                          <span>{[mentor.year, mentor.department].filter(Boolean).join(" · ") || "Mentor"}</span>
                          {mentor.startupType && <small>{mentor.startupType}</small>}
                        </div>
                        <button type="button" className="ghost-app-button mentor-request-button" onClick={() => { setSelectedMentor(mentor); setRequestMessage(""); }} disabled={requestState.accepted}>
                          {requestState.accepted ? <><Check size={13}/> Connected</> : requestState.pending ? <>Request again <Send size={13}/></> : <>Request <Send size={13}/></>}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              {mentorRequests.length > 0 && (
                <div className="my-mentor-requests">
                  <p className="app-kicker">YOUR REQUESTS</p>
                  {mentorRequests.map((request) => (
                    <div className="my-mentor-request-row" key={request.id}>
                      <span>{request.mentorName}</span>
                      <strong className={`request-status ${request.status}`}>{requestLabel(request.status)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="profile-subsection">
            <div className="subsection-title"><div><p className="app-kicker">SKILLS</p><h3>What you bring</h3></div></div>
            <div className="skill-list">{form.skills.map(skill => <span key={skill}>{skill}{editing&&<button type="button" onClick={()=>setField("skills",form.skills.filter(s=>s!==skill))}>×</button>}</span>)}</div>
            {editing&&<div className="add-skill"><input value={newSkill} onChange={(e)=>setNewSkill(e.target.value)} placeholder="Add a skill"/><button type="button" onClick={addSkill}><Plus size={15}/> Add</button></div>}
          </div>

          <div className="profile-subsection">
            <p className="app-kicker">ACCOUNT</p><h3>Member ID</h3>
            <div className="experience-item"><span className="experience-year">ID</span><div><strong>{profile?.userId || firebaseUser?.uid}</strong><p>Role: {roleTitle}</p></div></div>
          </div>

          {error&&<div className="login-error">{error}</div>}
          {saved&&<div className="save-confirm"><Check size={15}/> Profile saved</div>}
        </section>
      </div>

      {toast && <div className="app-toast" role="status"><Check size={15}/><span>{toast}</span></div>}

      {selectedMentor && (
        <div className="review-overlay" role="dialog" aria-modal="true">
          <div className="panel review-modal mentorship-request-modal">
            <button className="review-close" onClick={() => setSelectedMentor(null)} aria-label="Close"><X size={17}/></button>
            <p className="app-kicker">MENTORSHIP REQUEST</p>
            <h2>Request {selectedMentor.name || "this mentor"}</h2>
            <p className="review-person">Tell them what you would like help with. You can keep it short.</p>
            <label>Message<textarea rows="5" value={requestMessage} onChange={(e)=>setRequestMessage(e.target.value)} placeholder="I would like your guidance on…"/></label>
            {toast && <div className="request-live-status" role="status"><Check size={14}/>{toast}</div>}
            <button className="primary-app-button" disabled={requesting || !requestMessage.trim()} onClick={sendMentorshipRequest}>
              <Send size={15}/>{requesting ? "Sending…" : "Send request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
