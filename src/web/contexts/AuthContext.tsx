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
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
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
  logoUrl: string;
  logoLoading: boolean;
  backgroundUrl: string;
  backgroundLoading: boolean;
  sidebarBgUrl: string;
  sidebarBgPosition: string;
  login: (email: string, password: string) => Promise<void>;
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
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("asrama_logo_cache") || "");
  const [logoLoading, setLogoLoading] = useState(() => !localStorage.getItem("asrama_logo_cache"));
  const [backgroundUrl, setBackgroundUrl] = useState(() => localStorage.getItem("asrama_background_cache") || "");
  const [backgroundLoading, setBackgroundLoading] = useState(() => !localStorage.getItem("asrama_background_cache"));
  const [sidebarBgUrl, setSidebarBgUrl] = useState(() => localStorage.getItem("asrama_sidebar_bg_cache") || "");
  const [sidebarBgPosition, setSidebarBgPosition] = useState(() => localStorage.getItem("asrama_sidebar_bg_pos_cache") || "50% 50%");

  // Load logo settings with real-time sync and caching optimization
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "config"), (snap) => {
      const firestoreLogo = snap.exists() ? (snap.data().logoUrl || "") : "";
      const firestoreBackground = snap.exists() ? (snap.data().backgroundUrl || "") : "";

      setLogoUrl((currentLogo) => {
        if (firestoreLogo !== currentLogo) {
          if (firestoreLogo) {
            localStorage.setItem("asrama_logo_cache", firestoreLogo);
          } else {
            localStorage.removeItem("asrama_logo_cache");
          }
          return firestoreLogo;
        }
        return currentLogo;
      });
      setLogoLoading(false);

      setBackgroundUrl((currentBg) => {
        if (firestoreBackground !== currentBg) {
          if (firestoreBackground) {
            localStorage.setItem("asrama_background_cache", firestoreBackground);
          } else {
            localStorage.removeItem("asrama_background_cache");
          }
          return firestoreBackground;
        }
        return currentBg;
      });
      setBackgroundLoading(false);

      const firestoreSidebarBg = snap.exists() ? (snap.data().sidebarBgUrl || "") : "";
      setSidebarBgUrl((current) => {
        if (firestoreSidebarBg !== current) {
          if (firestoreSidebarBg) {
            localStorage.setItem("asrama_sidebar_bg_cache", firestoreSidebarBg);
          } else {
            localStorage.removeItem("asrama_sidebar_bg_cache");
          }
          return firestoreSidebarBg;
        }
        return current;
      });

      const firestoreSidebarBgPos = snap.exists() ? (snap.data().sidebarBgPosition || "50% 50%") : "50% 50%";
      setSidebarBgPosition((current) => {
        if (firestoreSidebarBgPos !== current) {
          localStorage.setItem("asrama_sidebar_bg_pos_cache", firestoreSidebarBgPos);
          return firestoreSidebarBgPos;
        }
        return current;
      });
    }, (err) => {
      console.error("Failed to sync settings:", err);
      setLogoLoading(false);
      setBackgroundLoading(false);
    });
    return unsub;
  }, []);

  // Sync favicon with the custom logoUrl setting dynamically
  useEffect(() => {
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      if (logoUrl) {
        link.href = logoUrl;
      } else {
        // Fallback to default money-bag emoji SVG
        link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>";
      }
    }
  }, [logoUrl]);

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
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      // Clean up previous profile listener
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      if (u) {
        setLoading(true);
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

        // Set up real-time listener for future profile updates or creation
        unsubProfile = onSnapshot(doc(db, "users", u.uid), (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
        }, (err) => {
          console.error("Profile onSnapshot failed:", err);
        });
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    // Only fire sign-in; onAuthStateChanged handles profile loading
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logoUrl, logoLoading, backgroundUrl, backgroundLoading, sidebarBgUrl, sidebarBgPosition, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
