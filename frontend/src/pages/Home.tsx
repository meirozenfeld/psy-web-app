// src/pages/Home.tsx
import { useEffect, useState, type ReactNode } from "react";
import { app, auth, db } from "../firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";

type UserProfile = {
  firstName?: string;
  lastName?: string;
  hasCompletedOnboarding?: boolean;
};

type NavItem = {
  label: string;
  path?: string;
  icon: ReactNode;
};

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // פרופיל מה-DB
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // שליטה על Sidebar (מובייל: פתוח=true, דסקטופ: פתוח=false -> ראה שימושים למטה)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    console.log("Firebase projectId:", app.options.projectId);

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
      if (!u) {
        navigate("/login", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  // משיכת מסמך המשתמש מ-Firestore
  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!alive) return;
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } catch (e) {
        console.error("Profile fetch error:", e);
      } finally {
        if (alive) setProfileLoading(false);
      }
    };

    setProfileLoading(true);
    setProfile(null);
    load();

    return () => {
      alive = false;
    };
  }, [user]);

  // סגירת מגירה במעבר נתיב
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // סגירה ב-Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const doLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const nav: NavItem[] = [
    {
      label: "Clients",
      path: "/clients",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11zM8 13c-2.67 0-8 1.34-8 4v2h8M16 13c.67 0 1.31.05 1.91.14C20.5 13.5 24 14.67 24 17v2h-8" />
        </svg>
      ),
    },
    {
      label: "Sessions",
      path: "/sessions",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="14" rx="2" strokeWidth="2" />
          <path d="M7 8h10M7 12h6" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "Calendar",
      path: "/calendar",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "Reports & Insights",
      path: "/reports",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 3v18h18" strokeWidth="2" />
          <path d="M7 15l3-3 3 3 4-6" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "Payments",
      path: "/payments",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
          <path d="M2 10h20" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "Notes",
      path: "/notes",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 4h12l4 4v12H4z" strokeWidth="2" />
          <path d="M16 4v4h4" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "My Profile",
      path: "/profile",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="8" r="4" strokeWidth="2" />
          <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" />
        </svg>
      ),
    },
    {
      label: "Settings",
      path: "/settings",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" strokeWidth="2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.07a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.07c.7 0 1.31-.4 1.51-1z" strokeWidth="1.5" />
        </svg>
      ),
    },
  ];

  const isLoadingApp = checking || profileLoading;

  if (isLoadingApp) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />

        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <div
            className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur text-center"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
            <p className="mt-3 text-sm text-slate-600">Loading your workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const welcomeName = (profile?.firstName && cap(profile.firstName.trim())) || "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />

      {/* ====== כפתורי פתיחה/סגירה ====== */}
      {/* מובייל: כפתור פתיחה צף (מופיע רק כשהמגירה סגורה) */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          aria-controls="mobile-sidebar"
          className="md:hidden fixed left-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-xl border border-white/60 bg-white/80 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* דסקטופ: כאשר הסיידבר סגור – כפתור פתיחה צף */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Open sidebar"
          aria-controls="desktop-sidebar"
          className="hidden md:grid fixed left-4 top-4 z-50 h-10 w-10 place-items-center rounded-xl border border-white/60 bg-white/80 text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
        >
          {/* המבורגר רגיל */}
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* ====== מובייל: מגירת Sidebar ====== */}
      {sidebarOpen && (
        <button
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          aria-label="Close menu overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="mobile-sidebar"
        className={
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 transform border border-white/60 bg-white/90 shadow-xl backdrop-blur transition-transform " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="px-4 py-4 border-b border-white/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12s2-5 9-5 9 5 9 5-2 5-9 5-9-5-9-5z" />
                  <path d="M12 8l1.5 3h3L13 15l-1.5-3h-3L12 8z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold leading-none">Psy Web-App</p>
                {user?.email && <p className="text-xs text-slate-500">{user.email}</p>}
              </div>
            </div>

            {/* כפתור סגירה במובייל (קווים + X) */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/60 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3">
          <ul className="space-y-1.5">
            {nav.map((item) => {
              const isActive = item.path ? location.pathname.startsWith(item.path) : false;
              const classes =
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition " +
                (isActive
                  ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
                  : "text-slate-700 hover:bg-sky-50 hover:text-sky-800");
              return (
                <li key={item.label}>
                  {item.path ? (
                    <button
                      className={classes}
                      onClick={() => {
                        setSidebarOpen(false);
                        navigate(item.path!);
                      }}
                    >
                      <span className="text-slate-500 group-hover:text-sky-700">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-2 pb-3 pt-2 border-t border-white/60">
          <button
            onClick={() => {
              setSidebarOpen(false);
              doLogout();
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" d="M15 3h4a2 2 0 0 1 2 2v4M10 17l5-5-5-5M15 12H3" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ====== שכבת התוכן (גדול יותר: max-w-[90rem]) ====== */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[90rem] gap-6 p-6">
        {/* Sidebar Desktop */}
        <aside
          id="desktop-sidebar"
          className={
            (sidebarOpen ? "hidden" : "hidden md:flex") +
            " w-64 flex-col rounded-2xl border border-white/60 bg-white/80 shadow-lg backdrop-blur"
          }
        >
          <div className="px-4 py-4 border-b border-white/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12s2-5 9-5 9 5 9 5-2 5-9 5-9-5-9-5z" />
                    <path d="M12 8l1.5 3h3L13 15l-1.5-3h-3L12 8z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold leading-none">Psy Web-App</p>
                  {user?.email && <p className="text-xs text-slate-500">{user.email}</p>}
                </div>
              </div>

              {/* כפתור סגירת סיידבר בדסקטופ (מופיע בתוך הכותרת מימין למעלה) */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Collapse sidebar"
                className="hidden md:grid h-9 w-9 place-items-center rounded-lg border border-white/60 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                {/* שלושה קווים + X */}
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="flex-1 px-2 py-3">
            <ul className="space-y-1.5">
              {nav.map((item) => {
                const isActive = item.path ? location.pathname.startsWith(item.path) : false;
                const classes =
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition " +
                  (isActive
                    ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
                    : "text-slate-700 hover:bg-sky-50 hover:text-sky-800");
                return (
                  <li key={item.label}>
                    {item.path ? (
                      <button
                        className={classes + " w-full text-left"}
                        onClick={() => navigate(item.path!)}
                      >
                        <span className="text-slate-500 group-hover:text-sky-700">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="px-2 pb-3 pt-2 border-t border-white/60">
            <button
              onClick={doLogout}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" d="M15 3h4a2 2 0 0 1 2 2v4M10 17l5-5-5-5M15 12H3" />
              </svg>
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 rounded-2xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome{welcomeName ? ` ${welcomeName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Select a section from the sidebar to get started.
          </p>

          {/* תוכן התחלתי / placeholder */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white/70 p-5">
              <h3 className="font-medium">Quick tips</h3>
              <ul className="mt-2 list-disc list-inside text-sm text-slate-600">
                <li>Use the sidebar to navigate between areas.</li>
                <li>Only Log out is implemented for now.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 p-5">
              <h3 className="font-medium">Next up</h3>
              <p className="mt-2 text-sm text-slate-600">
                We’ll wire up each section to real pages and data.
              </p>
            </div>
          </div>

          {/* Mobile notice */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-sky-50 p-4 text-sm text-sky-800 md:hidden">
            On mobile, the sidebar is hidden — open this page on a wider screen to see it.
          </div>
        </main>
      </div>
    </div>
  );
}
