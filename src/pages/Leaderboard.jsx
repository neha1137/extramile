import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Crown, Medal, Trophy } from "lucide-react";
import { subscribeToLeaderboard } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

export default function Leaderboard() {
  const { firebaseUser, role } = useAuth();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard(
      (data) => {
        setPeople(data.filter((p) => p.role === "extra-miler"));
        setLoading(false);
        setError("");
      },
      (err) => {
        console.error("[Extra Mile] Leaderboard failed:", err);
        setError(err.message || "Could not load the leaderboard.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const ranked = useMemo(() => people.map((p) => ({ ...p, points: Number(p.xp || 0) })).sort((a,b)=>b.points-a.points), [people]);
  const currentIndex = ranked.findIndex((p) => p.id === firebaseUser?.uid);
  const currentRank = currentIndex >= 0 ? currentIndex + 1 : null;
  const top = ranked.slice(0,3);

  if (loading) return <div className="leaderboard-page"><div className="panel loading-panel">Loading the board…</div></div>;
  return <div className="leaderboard-page"><div className="page-intro"><div><p className="app-kicker">THE EXTRA MILE / RANKINGS</p><h1>Move the <span>board.</span></h1><p>Points come from evaluated submissions. Everyone starts at zero.</p></div>{role === "extra-miler" && <div className="rank-badge"><Trophy size={18}/><strong>{currentRank ? `#${currentRank}` : "Not ranked"}</strong><span>Your rank</span></div>}</div>{error&&<div className="login-error">{error}</div>}<div className="leader-top-three">{ranked.length === 0 ? <div className="panel loading-panel" style={{gridColumn:"1 / -1",padding:28}}><Trophy size={26} style={{margin:"0 auto 10px",opacity:.55}}/><strong style={{display:"block",marginBottom:6}}>The leaderboard is waiting for its first Extra Miler.</strong><span style={{color:"var(--app-muted, #8589a7)"}}>Active Extra Miler accounts will appear here with 0 points, even before they submit a task. Points increase after evaluations.</span></div> : <>{top[1]&&<div className="podium second"><Medal size={20}/><span>02</span><strong>{top[1].name || top[1].userId}</strong><small>{top[1].points} pts</small></div>}{top[0]&&<div className="podium first"><Crown size={22}/><span>01</span><strong>{top[0].name || top[0].userId}</strong><small>{top[0].points} pts</small></div>}{top[2]&&<div className="podium third"><Medal size={19}/><span>03</span><strong>{top[2].name || top[2].userId}</strong><small>{top[2].points} pts</small></div>}</>}</div><section className="panel leaderboard-table"><div className="leader-head"><span>RANK</span><span>EXTRA MILER</span><span>STARTUP TYPE</span><span>POINTS</span></div>{ranked.length===0?<div className="loading-panel">No active Extra Miler profiles yet. Assign a participant the Extra Miler role to add them to the board.</div>:ranked.map((p,i)=><div className={`leader-row ${p.id===firebaseUser?.uid?"you":""}`} key={p.id}><strong>{String(i+1).padStart(2,"0")}</strong><div className="leader-person"><span className="avatar">{(p.name||"EM").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</span><span>{p.name || p.userId}</span></div><span>{p.startupType || p.department || "Not added"}</span><strong>{p.points}</strong><ArrowUpRight size={15}/></div>)}</section></div>;
}
