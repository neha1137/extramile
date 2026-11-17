import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  runTransaction,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./config";

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getActiveTasks() {
  const q = query(collection(db, "tasks"), where("active", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
}

export function subscribeToActiveTasks(onChange, onError) {
  const q = query(collection(db, "tasks"), where("active", "==", true));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
    onChange(items);
  }, onError);
}

export async function createTask(data) {
  const payload = {
    title: String(data.title || "").trim(),
    chapter: String(data.chapter || "").trim(),
    description: String(data.description || "").trim(),
    deadline: data.deadline || null,
    points: Number(data.points || 0),
    maxMarks: Number(data.maxMarks || 100),
    submissionType: data.submissionType || "file",
    rubric: Array.isArray(data.rubric) ? data.rubric : [],
    order: Number(data.order || 999),
    active: data.active !== false,
    createdBy: data.createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!payload.title) throw new Error("Task title is required.");
  if (!payload.description) throw new Error("Task description is required.");
  const ref = await addDoc(collection(db, "tasks"), payload);
  return ref.id;
}

export async function getTask(taskId) {
  const snapshot = await getDoc(doc(db, "tasks", taskId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createSubmission(data) {
  const submission = {
    ...data,
    status: "pending",
    marks: null,
    feedback: "",
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
  };
  const ref = await addDoc(collection(db, "submissions"), submission);
  return ref.id;
}

export async function getMySubmissions(uid) {
  const q = query(collection(db, "submissions"), where("studentId", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

export function subscribeToMySubmissions(uid, onChange, onError) {
  const q = query(collection(db, "submissions"), where("studentId", "==", uid));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    onChange(items);
  }, onError);
}

export async function getSubmissionQueue() {
  const q = query(collection(db, "submissions"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

export function subscribeToSubmissionQueue(onChange, onError) {
  const q = query(collection(db, "submissions"));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
    onChange(items);
  }, onError);
}

export async function updateSubmission(submissionId, data, studentId = null) {
  const submissionRef = doc(db, "submissions", submissionId);
  if (!studentId || data.status !== "reviewed") {
    await updateDoc(submissionRef, { ...data, reviewedAt: serverTimestamp() });
    return;
  }

  const studentRef = doc(db, "users", studentId);
  await runTransaction(db, async (transaction) => {
    const [submissionSnap, studentSnap] = await Promise.all([
      transaction.get(submissionRef),
      transaction.get(studentRef),
    ]);
    if (!submissionSnap.exists()) throw new Error("Submission no longer exists.");
    if (!studentSnap.exists()) throw new Error("Student profile no longer exists.");

    const previousXp = Number(submissionSnap.data().xpAwarded || 0);
    const nextXp = Number(data.xpAwarded || 0);
    const delta = nextXp - previousXp;
    transaction.update(submissionRef, { ...data, reviewedAt: serverTimestamp() });
    const notificationRef = doc(collection(db, "notifications"));
    transaction.set(notificationRef, {
      recipientId: studentId,
      type: "evaluation",
      title: "Task evaluated",
      body: `Your submission for “${submissionSnap.data().taskTitle || "this task"}” was reviewed. You earned ${nextXp} points.`,
      taskId: submissionSnap.data().taskId || null,
      submissionId,
      read: false,
      createdAt: serverTimestamp(),
    });
    if (delta) {
      const currentXp = Number(studentSnap.data().xp || 0);
      const nextTotal = Math.max(0, currentXp + delta);
      transaction.update(studentRef, {
        xp: nextTotal,
        level: Math.max(1, Math.floor(nextTotal / 100) + 1),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function getPeople() {
  const q = query(collection(db, "users"), where("active", "==", true), limit(100));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export function subscribeToPeople(onChange, onError) {
  const q = query(collection(db, "users"), where("active", "==", true), limit(100));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    onChange(items);
  }, onError);
}

export async function getLeaderboard() {
  const q = query(collection(db, "users"), where("active", "==", true), limit(100));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
}


export function subscribeToLeaderboard(onChange, onError) {
  const q = query(collection(db, "users"), where("active", "==", true), limit(100));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
    onChange(items);
  }, onError);
}

export function subscribeToMyNotifications(uid, onChange, onError) {
  const q = query(collection(db, "notifications"), where("recipientId", "==", uid), limit(100));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    onChange(items);
  }, onError);
}

export async function createNotification(data) {
  return addDoc(collection(db, "notifications"), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export function subscribeToOpportunities(onChange, onError) {
  const q = query(collection(db, "opportunities"), limit(200));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(a.deadline || a.date || "").localeCompare(String(b.deadline || b.date || "")));
    onChange(items);
  }, onError);
}

export async function createOpportunity(data) {
  const payload = {
    title: String(data.title || "").trim(),
    org: String(data.org || "").trim(),
    category: data.category || "Other",
    date: String(data.date || data.deadline || "").trim(),
    deadline: String(data.deadline || data.date || "").trim(),
    location: String(data.location || "Online").trim(),
    tag: String(data.tag || "OPPORTUNITY").trim().toUpperCase(),
    description: String(data.description || "").trim(),
    url: String(data.url || "").trim(),
    image: String(data.image || "").trim(),
    source: data.source || "manual",
    createdBy: data.createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!payload.title || !payload.url) throw new Error("Opportunity title and URL are required.");
  const ref = await addDoc(collection(db, "opportunities"), payload);
  return ref.id;
}

export async function updateOpportunity(id, data) {
  await updateDoc(doc(db, "opportunities", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteOpportunity(id) {
  await deleteDoc(doc(db, "opportunities", id));
}

export async function createCalendarEvent({ title, description = "", date, startTime = "", endTime = "", type = "general", visibility = "personal", participantIds = [] }, createdBy) {
  const participants = Array.from(new Set([createdBy, ...participantIds].filter(Boolean)));
  const ref = await addDoc(collection(db, "calendarEvents"), {
    title: title.trim(),
    description: description.trim(),
    date,
    startTime,
    endTime,
    type,
    visibility,
    participantIds: participants,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCalendarEvent(eventId, { title, description = "", date, startTime = "", endTime = "", type = "general", visibility = "personal", participantIds = [] }, createdBy) {
  const participants = Array.from(new Set([createdBy, ...participantIds].filter(Boolean)));
  await updateDoc(doc(db, "calendarEvents", eventId), {
    title: title.trim(),
    description: description.trim(),
    date,
    startTime,
    endTime,
    type,
    visibility,
    participantIds: participants,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCalendarEvent(eventId) {
  await deleteDoc(doc(db, "calendarEvents", eventId));
}

export function subscribeToCalendarEvents(uid, onChange, onError) {
  const allQuery = query(collection(db, "calendarEvents"), where("visibility", "==", "all"), limit(200));
  const personalQuery = query(collection(db, "calendarEvents"), where("createdBy", "==", uid), limit(200));
  const participantQuery = query(collection(db, "calendarEvents"), where("participantIds", "array-contains", uid), limit(200));
  const byId = new Map();
  let ready = 0;
  let failed = false;
  const emit = () => onChange(Array.from(byId.values()).sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))));
  const handle = (snapshot) => {
    snapshot.docs.forEach((item) => byId.set(item.id, { id: item.id, ...item.data() }));
    ready += 1;
    if (ready >= 3) emit();
  };
  const handleError = (err) => {
    // A denied auxiliary calendar listener should not turn a successful
    // create/update/delete operation into a scary global error banner.
    // The write operation itself still surfaces a failure if Firebase rejects it.
    if (!failed) { failed = true; onError?.(err); }
  };
  const unsubAll = onSnapshot(allQuery, handle, handleError);
  const unsubPersonal = onSnapshot(personalQuery, handle, handleError);
  const unsubParticipants = onSnapshot(participantQuery, handle, handleError);
  return () => { unsubAll(); unsubPersonal(); unsubParticipants(); };
}


export function subscribeToMentors(onChange, onError) {
  // Query only the field already guaranteed by the user-read rule, then
  // filter the role in the client. This avoids Firestore rejecting a
  // compound role/active query when rules are evaluated for every result.
  const q = query(
    collection(db, "users"),
    where("active", "==", true),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.role === "mentor");
    onChange(items);
  }, onError);
}

export function subscribeToMyMentorshipRequests(studentId, onChange, onError) {
  const q = query(
    collection(db, "mentorshipRequests"),
    where("studentId", "==", studentId),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    onChange(items);
  }, onError);
}

export function subscribeToMentorRequests(mentorId, onChange, onError) {
  const q = query(
    collection(db, "mentorshipRequests"),
    where("mentorId", "==", mentorId),
    limit(100)
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    onChange(items);
  }, onError);
}

export async function createMentorshipRequest({ studentId, studentName, mentorId, mentorName, message }) {
  const normalizedMessage = (message || "").trim().replace(/\s+/g, " ");
  if (!normalizedMessage) throw new Error("Write a short message before sending the request.");

  const existingQuery = query(
    collection(db, "mentorshipRequests"),
    where("studentId", "==", studentId),
    where("mentorId", "==", mentorId),
    limit(100)
  );
  const existingSnapshot = await getDocs(existingQuery);
  const existing = existingSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const accepted = existing.find((item) => item.status === "accepted");
  if (accepted) {
    const error = new Error("You are already connected with this mentor.");
    error.code = "MENTOR_REQUEST_ALREADY_CONNECTED";
    throw error;
  }

  // Multiple requests are allowed. Only an exact duplicate of an existing
  // pending message for the same student + mentor is blocked.
  const duplicate = existing.find((item) =>
    item.status === "pending" &&
    String(item.message || "").trim().replace(/\s+/g, " ").toLowerCase() === normalizedMessage.toLowerCase()
  );
  if (duplicate) {
    const error = new Error("You already sent this exact message to this mentor. Try a different message.");
    error.code = "MENTOR_REQUEST_DUPLICATE";
    throw error;
  }

  const requestRef = doc(collection(db, "mentorshipRequests"));
  const notificationRef = doc(collection(db, "notifications"));
  await runTransaction(db, async (transaction) => {
    transaction.set(requestRef, {
      studentId,
      studentName,
      mentorId,
      mentorName,
      message: normalizedMessage,
      status: "pending",
      createdAt: serverTimestamp(),
      respondedAt: null,
    });
    transaction.set(notificationRef, {
      recipientId: mentorId,
      senderId: studentId,
      type: "mentor_request",
      title: `${studentName || "An Extra Miler"} requested your mentorship`,
      body: normalizedMessage || "An Extra Miler has asked for your guidance.",
      requestId: requestRef.id,
      read: false,
      createdAt: serverTimestamp(),
    });
  });
  return { id: requestRef.id, updated: false };
}

export async function respondToMentorshipRequest(requestId, status) {
  if (!["accepted", "declined"].includes(status)) throw new Error("Invalid mentorship request status.");
  const requestRef = doc(db, "mentorshipRequests", requestId);
  const notificationRef = doc(collection(db, "notifications"));

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) throw new Error("Mentorship request no longer exists.");
    const request = requestSnap.data();
    if (request.status !== "pending") throw new Error(`This request is already ${request.status}.`);

    transaction.update(requestRef, {
      status,
      respondedAt: serverTimestamp(),
    });

    transaction.set(notificationRef, {
      recipientId: request.studentId,
      senderId: request.mentorId,
      type: "mentor_response",
      title: `${request.mentorName || "Your mentor"} ${status === "accepted" ? "accepted" : "declined"} your mentorship request`,
      body: status === "accepted"
        ? "Your mentor is ready to connect with you."
        : "Your mentorship request was declined. You can explore other mentors.",
      requestId,
      status,
      read: false,
      createdAt: serverTimestamp(),
    });

    if (status === "accepted") {
      transaction.set(doc(collection(db, "calendarEvents")), {
        title: `Mentorship connection · ${request.studentName || "Extra Miler"}`,
        description: "Mentorship connection created after a request was accepted.",
        date: new Date().toISOString().slice(0, 10),
        startTime: "",
        endTime: "",
        type: "mentorship",
        visibility: "participants",
        participantIds: [request.studentId, request.mentorId],
        createdBy: request.mentorId,
        createdAt: serverTimestamp(),
      });
    }
  });
}
