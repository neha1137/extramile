import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import { auth, firebaseConfigured } from "./config";

// Firebase Authentication uses the participant's real email address.
export async function loginWithEmail(email, password) {
  if (!firebaseConfigured || !auth) throw new Error("Firebase is not configured. Complete the Firebase setup steps first.");
  const normalizedEmail = String(email || "").trim();
  return signInWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function sendPasswordReset(email) {
  if (!firebaseConfigured || !auth) throw new Error("Firebase is not configured. Complete the Firebase setup steps first.");
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) throw new Error("Enter your email address first.");
  return sendPasswordResetEmail(auth, normalizedEmail);
}

export async function changeCurrentPassword(currentPassword, newPassword) {
  if (!firebaseConfigured || !auth) throw new Error("Firebase is not configured. Complete the Firebase setup steps first.");
  const user = auth.currentUser;
  if (!user?.email) throw new Error("No signed-in user.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function logout() {
  return auth ? signOut(auth) : Promise.resolve();
}
