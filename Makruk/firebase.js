// ═══════════════════════════════════════════════
//   firebase.js — Firebase init & shared helpers
// ═══════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCJjQsqiJsbJW0pwlI0fqnklRhKFPSJh_w",
  authDomain: "rukthai-b4971.firebaseapp.com",
  projectId: "rukthai-b4971",
  storageBucket: "rukthai-b4971.firebasestorage.app",
  messagingSenderId: "140554271105",
  appId: "1:140554271105:web:00530dbfb7b8c4aed1d080",
  measurementId: "G-R5HB0F5YD6",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ── User profile helpers ──────────────────────

export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), {
    uid,
    name: data.name,
    email: data.email,
    avatar: data.avatar || "",
    friends: [],
    friendRequests: [],
    createdAt: Date.now(),
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

export async function searchUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ── Friend helpers ────────────────────────────

export async function sendFriendRequest(fromUid, toUid) {
  // Add fromUid to toUser's friendRequests
  await updateDoc(doc(db, "users", toUid), {
    friendRequests: arrayUnion(fromUid),
  });
}

export async function acceptFriendRequest(myUid, fromUid) {
  // Add each other to friends list, remove request
  await updateDoc(doc(db, "users", myUid), {
    friends: arrayUnion(fromUid),
    friendRequests: arrayRemove(fromUid),
  });
  await updateDoc(doc(db, "users", fromUid), {
    friends: arrayUnion(myUid),
  });
}

export async function declineFriendRequest(myUid, fromUid) {
  await updateDoc(doc(db, "users", myUid), {
    friendRequests: arrayRemove(fromUid),
  });
}

export async function removeFriend(myUid, friendUid) {
  await updateDoc(doc(db, "users", myUid), {
    friends: arrayRemove(friendUid),
  });
  await updateDoc(doc(db, "users", friendUid), {
    friends: arrayRemove(myUid),
  });
}

export async function getFriendProfiles(uid) {
  const profile = await getUserProfile(uid);
  if (!profile || !profile.friends?.length) return [];
  const results = await Promise.all(profile.friends.map(fid => getUserProfile(fid)));
  return results.filter(Boolean);
}

export async function getFriendRequestProfiles(uid) {
  const profile = await getUserProfile(uid);
  if (!profile || !profile.friendRequests?.length) return [];
  const results = await Promise.all(profile.friendRequests.map(fid => getUserProfile(fid)));
  return results.filter(Boolean);
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
};
EOF
Output