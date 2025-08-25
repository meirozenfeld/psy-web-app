import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [checking, setChecking]   = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/login", { replace: true });
        return;
      }
      setUser(u);

      // אם כבר סיים אונבורדינג—דלג ל-Home
      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists() && snap.data()?.hasCompletedOnboarding) {
        navigate("/", { replace: true });
        return;
      }
      setChecking(false);
    });
    return () => unsub();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErr(null);
    setLoading(true);
    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(ref, {
        uid: user.uid,
        email: user.email ?? null,
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        hasCompletedOnboarding: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      navigate("/", { replace: true });
    } catch (e: any) {
      setErr("Could not save your profile. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading…</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12s2-5 9-5 9 5 9 5-2 5-9 5-9-5-9-5z" />
                <path d="M12 8l1.5 3h3L13 15l-1.5-3h-3L12 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Complete your profile</h1>
            <p className="mt-1 text-sm text-slate-600">Just a few details to get started</p>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur">
            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">First name</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="Jane"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Last name</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Doe"
                />
              </div>

              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-sky-600 py-2.5 font-medium text-white shadow transition hover:bg-sky-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-600"
              >
                <span className="relative z-10">{loading ? "Saving…" : "Continue"}</span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition group-hover:translate-x-full" />
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Psy Web-App
          </p>
        </div>
      </div>
    </div>
  );
}
