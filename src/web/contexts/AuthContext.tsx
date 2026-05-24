import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

export type UserRole = "admin" | "penghuni";

interface UserProfile {
  role: UserRole;
  residentId?: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserRole>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile from Firestore
  const loadProfile = async (u: User): Promise<UserProfile | null> => {
    // 1. Try to fetch by UID (Standard)
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    // 2. Fallback: Try to fetch by email (In case document was created manually with Auto-ID in Firebase Console)
    if (u.email) {
      const emailQuery = query(collection(db, "users"), where("email", "==", u.email));
      const emailSnap = await getDocs(emailQuery);
      const firstDoc = emailSnap.docs[0];
      if (!emailSnap.empty && firstDoc) {
        const profileData = firstDoc.data() as UserProfile;
        
        // Auto-migrate: save this profile under the correct UID for future logins
        await setDoc(doc(db, "users", u.uid), profileData);
        
        return profileData;
      }
    }

    // 3. Auto-setup: if NO admin exists yet, make this user the first admin
    const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
    const adminSnap = await getDocs(adminQuery);
    if (adminSnap.empty) {
      const newProfile: UserProfile = {
        role: "admin",
        email: u.email || "",
      };
      await setDoc(doc(db, "users", u.uid), newProfile);
      return newProfile;
    }

    // User exists in Auth but has no profile — shouldn't happen normally
    return null;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setLoading(true); // Prevent premature routing while profile is loading
        setUser(u);
        try {
          const p = await loadProfile(u);
          setProfile(p);
        } catch (err) {
          console.error("Failed to load profile:", err);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string): Promise<UserRole> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const p = await loadProfile(cred.user);
    setProfile(p);
    return p?.role || "penghuni";
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
