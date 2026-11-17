import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./auth-context";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseConfigured } from "../firebase/config";
import { changeCurrentPassword, loginWithEmail, logout } from "../firebase/auth";
import { getUserProfile } from "../firebase/firestore";


export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured || !auth) return undefined;
    return onAuthStateChanged(auth, async (nextUser) => {
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const nextProfile = await getUserProfile(nextUser.uid);
        setProfile(nextProfile);
      } catch (error) {
        console.error("Could not load Extra Mile profile", error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo(() => ({
    firebaseUser,
    profile,
    loading,
    isAuthenticated: Boolean(firebaseUser),
    role: profile?.role || null,
    login: loginWithEmail,
    logout,
    changePassword: changeCurrentPassword,
    refreshProfile: async () => {
      if (!firebaseUser) return null;
      const nextProfile = await getUserProfile(firebaseUser.uid);
      setProfile(nextProfile);
      return nextProfile;
    },
  }), [firebaseUser, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
