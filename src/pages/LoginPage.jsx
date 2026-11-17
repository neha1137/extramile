import { useState } from "react";
import { sendPasswordReset } from "../firebase/auth";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Stars from "../components/Stars";
import { useAuth } from "../context/useAuth";



function friendlyAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email address or password is incorrect.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait a little and try again.";
  if (code.includes("network-request-failed")) return "Network error. Check your internet connection and try again.";
  return error?.message || "Could not sign you in.";
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, changePassword, profile } = useAuth();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      // The role and permissions are read from Firestore after sign-in.
      navigate("/app/dashboard");
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!email.trim()) throw new Error("Enter your email address first.");
      await sendPasswordReset(email.trim());
      setResetSent(true);
    } catch (err) {
      const code = err?.code || "";
      if (code.includes("auth/invalid-email")) setError("Enter a valid email address.");
      else if (code.includes("auth/user-not-found") || code.includes("auth/invalid-credential")) {
        setError("No account was found for that email address.");
      } else setError(err.message || "Could not request a password reset.");
    } finally { setBusy(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!email || !password || newPassword.length < 6) {
        throw new Error("Use your email address, current password, and a new password of at least 6 characters.");
      }
      // Reauthenticate + update password for the currently authenticated account.
      // If the user isn't signed in, sign in first with the current password.
      if (!profile) await login(email, password);
      await changePassword(password, newPassword);
      setMode("login");
      setPassword("");
      setNewPassword("");
      setError("");
      navigate("/app/dashboard");
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page fun-login">
      <Stars />
      <Link to="/" className="login-back"><ArrowLeft size={16} /> Back to Extra Mile</Link>

      <div className="login-shell">
        <section className="login-story">
          <div className="login-mark"><span /><span /><span /><span /></div>
          <p className="login-kicker">EXTRA MILE / MEMBER SPACE</p>
          <h1>Come in.<br /><em>Go further.</em></h1>
          <p className="login-story-copy">This isn't another college portal. It's your little corner of the Extra Mile universe.</p>
          <div className="login-story-rule"><span /> <span>BUILD · CONNECT · GO FURTHER</span></div>
        </section>

        <section className="login-card">
          <div className="login-card-head">
            <div className="login-logo-word"><strong>EXTRA</strong><strong>MILE</strong></div>
            <div className="login-status"><span /> Member access</div>
          </div>

          {(() => {
            switch (mode) {
              case "forgot":
                return (
                  <>
                    <div className="login-heading"><p className="section-kicker">ACCOUNT RECOVERY</p><h2>Reset your <span>password.</span></h2></div>
                    {resetSent ? <div className="login-form"><div className="submission-success">If your account has a verified recovery email, a reset link will arrive shortly. Check your inbox and spam folder.</div><button type="button" className="login-submit" onClick={() => { setMode("login"); setResetSent(false); setError(""); }}>Back to login <ArrowRight size={18}/></button></div> : <form onSubmit={handleForgotPassword} className="login-form">
                      <label>Email Address<div className="login-input-wrap"><UserRound size={17}/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></div></label>
                      {error && <div className="login-error" role="alert">{error}</div>}
                      <button className="login-submit" type="submit" disabled={busy}>{busy ? "Sending link…" : "Email me a reset link"} {!busy && <ArrowRight size={18}/>}</button>
                      <button type="button" className="login-secondary" onClick={() => { setMode("login"); setError(""); }}>Back to login</button>
                    </form>}
                    <p className="login-note">A password-reset link will be sent to the email address associated with your Firebase Authentication account. Check your inbox and spam folder.</p>
                  </>
                );
              case "change":
                return (
                  <>
                    <div className="login-heading"><p className="section-kicker">ACCOUNT ACCESS</p><h2>Change your <span>password.</span></h2></div>
                    <form onSubmit={handleChangePassword} className="login-form">
                      <label>Email Address<div className="login-input-wrap"><UserRound size={17}/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username" /></div></label>
                      <label>Current password<div className="login-input-wrap"><LockKeyhole size={17}/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password" required /></div></label>
                      <label>New password<div className="login-input-wrap"><LockKeyhole size={17}/><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Choose a new password" minLength={6} required /></div></label>
                      {error && <div className="login-error" role="alert">{error}</div>}
                      <button className="login-submit" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"} {!busy && <ArrowRight size={18}/>}</button>
                      <button type="button" className="login-secondary" onClick={() => { setError(""); setMode("login"); }}>Back to login</button>
                    </form>
                    <p className="login-note">Password changes are handled by Firebase Authentication. Passwords are never stored in your Firestore profile.</p>
                  </>
                );
              case "login":
              default:
                return (
                  <>
                    <div className="login-heading"><p className="section-kicker">WELCOME BACK</p><h2>Come <span>in.</span></h2></div>
                    <form onSubmit={handleLogin} className="login-form">
                      <label>Email Address<div className="login-input-wrap"><UserRound size={17}/><input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username" /></div></label>
                      <label>Password<div className="login-input-wrap"><LockKeyhole size={17}/><input name="password" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Enter your password" required autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
                      {error && <div className="login-error" role="alert">{error}</div>}
                      <div className="login-options"><label className="remember"><input type="checkbox"/> <span>Remember this device</span></label><button type="button" className="forgot" onClick={() => { setError(""); setResetSent(false); setMode("forgot"); }}>Forgot password?</button><button type="button" className="forgot" onClick={() => { setError(""); setMode("change"); }}>Change password</button></div>
                      <button className="login-submit" type="submit" disabled={busy}>{busy ? "Entering…" : "Enter Extra Mile"} {!busy && <ArrowRight size={18}/>}</button>
                    </form>
                    <p className="login-note">Sign in using the email address registered with your Extra Mile account. Your role and permissions are loaded from Firebase after sign-in.</p>
                  </>
                );
            }
          })()}
        </section>
      </div>
    </div>
  );
}
