import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, BriefcaseBusiness, CalendarDays, ClipboardCheck, Home, Menu, Search, Trophy, UserRound, Users, X, LogOut, ShieldCheck, Compass, Settings2 } from "lucide-react";
import Stars from "./Stars";
import { useAuth } from "../context/useAuth";
import { subscribeToMyNotifications } from "../firebase/firestore";

const roleLabels = { "extra-miler": "Extra Miler", mentor: "Mentor", evaluator: "Evaluator", admin: "Admin" };
const navByRole = {
  "extra-miler": [
    ["Dashboard", "/app/dashboard", Home], ["My Profile", "/app/profile", UserRound], ["My Tasks", "/app/tasks", ClipboardCheck], ["Opportunities", "/app/opportunities", BriefcaseBusiness], ["People", "/app/people", Users], ["Leaderboard", "/app/leaderboard", Trophy], ["Calendar", "/app/calendar", CalendarDays], ["Notifications", "/app/notifications", Bell],
  ],
  mentor: [
    ["Dashboard", "/app/dashboard", Home], ["My Profile", "/app/profile", UserRound], ["People", "/app/people", Users], ["Mentorship", "/app/mentors", Compass], ["Opportunities", "/app/opportunities", BriefcaseBusiness], ["Calendar", "/app/calendar", CalendarDays], ["Notifications", "/app/notifications", Bell],
  ],
  evaluator: [
    ["Dashboard", "/app/dashboard", Home], ["My Profile", "/app/profile", UserRound], ["Submissions", "/app/evaluations", ShieldCheck], ["People", "/app/people", Users], ["Opportunities", "/app/opportunities", BriefcaseBusiness], ["Calendar", "/app/calendar", CalendarDays], ["Notifications", "/app/notifications", Bell],
  ],
  admin: [
    ["Dashboard", "/app/dashboard", Home], ["My Profile", "/app/profile", UserRound], ["Submissions", "/app/evaluations", ShieldCheck], ["People", "/app/people", Users], ["Leaderboard", "/app/leaderboard", Trophy], ["Mentorship", "/app/mentors", Compass], ["Opportunities", "/app/opportunities", BriefcaseBusiness], ["Calendar", "/app/calendar", CalendarDays], ["Notifications", "/app/notifications", Bell], ["Admin space", "/app/dashboard", Settings2],
  ],
};

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, role, logout, firebaseUser } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!firebaseUser?.uid) return undefined;
    return subscribeToMyNotifications(firebaseUser.uid, (items) => {
      setUnreadCount(items.filter((item) => !item.read).length);
    }, (error) => {
      console.error("[Extra Mile] Notification badge failed:", error);
    });
  }, [firebaseUser?.uid]);
  const navigate = useNavigate();
  const location = useLocation();
  const items = useMemo(() => navByRole[role] || navByRole["extra-miler"], [role]);
  const initials = (profile?.name || "Extra Miler").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return <div className="app-shell fun-app-shell">
    <Stars />
    <aside className={`app-sidebar ${mobileOpen ? "is-open" : ""}`}>
      <div className="app-brand"><img src="/extra-mile-logo.png" alt="Extra Mile Season 2" className="app-brand-logo" /></div>
      <div className="club-tag"><span className="club-tag-mark" aria-hidden="true" /> {roleLabels[role] || "Member"} space</div>
      <div className="sidebar-label">YOUR SPACE</div>
      <nav className="app-nav">{items.map(([label,to,Icon]) => <NavLink key={`${label}-${to}`} to={to} onClick={() => setMobileOpen(false)} className={({isActive}) => `app-nav-link ${isActive ? "active" : ""}`}><Icon size={18} strokeWidth={1.8}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-mood"><span className="mood-mark" aria-hidden="true" /> <span>one more mile?</span></div><button className="sidebar-logout" onClick={handleLogout}><LogOut size={17}/><span>Log out</span></button></div>
    </aside>
    {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation"/>}
    <div className="app-main">
      <header className="app-topbar">
        <button className="app-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">{mobileOpen ? <X size={21}/> : <Menu size={21}/>}</button>
        <div className="topbar-search"><Search size={17}/><input placeholder="Search your Extra Mile..." aria-label="Search"/></div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => navigate("/app/notifications")} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}><Bell size={19}/>{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
          <div className="role-badge">{roleLabels[role] || "Member"}</div>
          <button className="topbar-profile" onClick={() => navigate("/app/profile")}><span className="avatar avatar-small">{profile?.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" /> : profile?.avatarEmoji ? profile.avatarEmoji : initials}</span><span className="topbar-name">{profile?.name || "Member"}</span></button>
        </div>
      </header>
      <main className="app-content" data-role={role}><div className="route-context" data-route={location.pathname}/><Outlet/></main>
    </div>
  </div>;
}
