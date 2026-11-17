import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles, UserRound, X } from "lucide-react";
import { subscribeToPeople } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

const roleNames = { "extra-miler": "Extra Miler", mentor: "Mentor", evaluator: "Evaluator", admin: "Admin" };

function initials(name = "Member") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}

export default function People() {
  const { role } = useAuth();
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToPeople(
      (data) => {
        setPeople(data);
        setLoading(false);
      },
      (err) => {
        console.error("[Extra Mile] People failed:", err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => people.filter((person) => {
    if (person.role === "admin" || person.role === "evaluator") return false;
    const text = `${person.name || ""} ${person.userId || ""} ${person.department || ""} ${person.year || ""} ${(person.skills || []).join(" ")} ${person.startupType || ""} ${(person.interests || []).join(" ")}`.toLowerCase();
    return text.includes(search.toLowerCase());
  }), [people, search]);

  return (
    <div className="people-page">
      <div className="page-intro people-intro">
        <div>
          <p className="app-kicker">THE EXTRA MILE CREW</p>
          <h1>Who's building <span>what?</span></h1>
          <p>Find the people behind the ideas. Open a profile to see what they have actually added.</p>
        </div>
        <div className="people-search task-search">
          <Search size={16}/>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search people, skills, ideas..." />
        </div>
      </div>

      <div className="people-banner">
        <Sparkles size={18}/>
        <div><strong>Your people are here.</strong><span>Profiles below come directly from the Extra Miler community.</span></div>
      </div>

      {loading ? <div className="panel loading-panel">Loading people…</div> : (
        <div className="people-grid">
          {filtered.map((person) => (
            <article className="person-card" key={person.id}>
              <div className="person-card-top">
                <span className="person-role">{roleNames[person.role] || person.role}</span>
                <span className="person-spark" aria-hidden="true" />
              </div>
              <div className="person-avatar">{person.avatarDataUrl ? <img src={person.avatarDataUrl} alt="" /> : person.avatarEmoji ? person.avatarEmoji : initials(person.name || person.userId)}</div>
              <h2>{person.name || person.userId}</h2>
              <p className="person-year">{[person.year, person.department].filter(Boolean).join(" · ") || "Profile details not added"}</p>
              <p className="person-vibe">{person.bio ? `“${person.bio}”` : "No bio added yet."}</p>
              {person.startupType && <div className="person-building"><span>{person.role === "mentor" ? "FOCUS" : "STARTUP TYPE"}</span><strong>{person.startupType}</strong></div>}
              {person.skills?.length > 0 && <div className="person-skills">{person.skills.slice(0,5).map((skill) => <span key={skill}>{skill}</span>)}</div>}
              <button className="ghost-app-button" type="button" onClick={() => setSelectedPerson(person)}>
                View profile <ArrowRight size={14}/>
              </button>
            </article>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && <div className="panel loading-panel">No people match your search.</div>}

      {selectedPerson && (
        <div className="review-overlay" role="dialog" aria-modal="true">
          <div className="panel people-profile-modal">
            <button className="review-close" onClick={() => setSelectedPerson(null)} aria-label="Close"><X size={17}/></button>
            <div className="people-modal-identity">
              <div className="person-avatar">{selectedPerson.avatarDataUrl ? <img src={selectedPerson.avatarDataUrl} alt="" /> : selectedPerson.avatarEmoji ? selectedPerson.avatarEmoji : initials(selectedPerson.name || selectedPerson.userId)}</div>
              <div>
                <p className="app-kicker">{roleNames[selectedPerson.role] || selectedPerson.role}</p>
                <h2>{selectedPerson.name || selectedPerson.userId}</h2>
                <p>{[selectedPerson.year, selectedPerson.department].filter(Boolean).join(" · ")}</p>
              </div>
            </div>

            <div className="people-modal-section">
              <p className="app-kicker">ABOUT</p>
              <p>{selectedPerson.bio || "No bio added yet."}</p>
            </div>

            {selectedPerson.startupType && (
              <div className="people-modal-section">
                <p className="app-kicker">{selectedPerson.role === "mentor" ? "MENTORSHIP FOCUS" : "STARTUP TYPE"}</p>
                <strong>{selectedPerson.startupType}</strong>
              </div>
            )}

            {selectedPerson.skills?.length > 0 && (
              <div className="people-modal-section">
                <p className="app-kicker">SKILLS</p>
                <div className="person-skills">{selectedPerson.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
              </div>
            )}

            {selectedPerson.interests?.length > 0 && (
              <div className="people-modal-section">
                <p className="app-kicker">INTERESTS</p>
                <div className="person-skills">{selectedPerson.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
              </div>
            )}

            <div className="people-modal-footer">
              <span><UserRound size={14}/> {selectedPerson.userId || "Member"}</span>
              <button className="primary-app-button" onClick={() => setSelectedPerson(null)}>Close profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
