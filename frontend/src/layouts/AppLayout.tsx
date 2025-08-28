// AppLayout: top-level shell with auth guard, live profile subscription, responsive sidebar,
// and a header that includes the OrgSwitcher and a small scope badge.

import { useEffect, useState } from "react";
import { app, auth, db } from "../firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import Sidebar, { type NavItem as SidebarNavItem } from "../components/Sidebar";

import OrgSwitcher from "./OrgSwitcher";
import { useScope } from "../scope/ScopeContext"; // read current scope (solo/org)
import ScopeRedirectOnChange from "../scope/ScopeRedirectOnChange"; // <-- add

// ---- Types ----
type UserProfile = {
  firstName?: string;
  lastName?: string;
  hasCompletedOnboarding?: boolean;
};

// Small badge that shows current scope (solo or org name)
function ScopeBadge() {
  const { scope } = useScope();
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700"
      title={scope.mode === "solo" ? "Personal mode" : "Clinic/Team mode"}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
      {scope.mode === "solo" ? "Scope: Solo" : `Scope: ${scope.orgName || "Clinic"}`}
    </span>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Sidebar UI state (mobile drawer + desktop collapsed mode)
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Auth guard + redirect
  useEffect(() => {
    // Helpful for verifying the correct Firebase project at runtime
    console.log("Firebase projectId:", app.options.projectId);

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
      if (!u) navigate("/login", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  // Live user profile document subscription; cleans up on unmount
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setProfileLoading(false);
      },
      (err) => {
        console.error("Profile live fetch error:", err);
        setProfileLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Close mobile sidebar when route changes
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const doLogout = async () => {
    try { await signOut(auth); navigate("/login", { replace: true }); }
    catch (e) { console.error("Logout error", e); }
  };

  // Sidebar nav items
  const nav: SidebarNavItem[] = [
    {
      label: "Home",
      path: "/",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M3 10l9-7 9 7v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4H9v4a2 2 0 0 1-2 2H3z" />
        </svg>
      ),
    },
    {
      label: "Clients", path: "/clients", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11zM8 13c-2.67 0-8 1.34-8 4v2h8M16 13c.67 0 1.31.05 1.91.14C20.5 13.5 24 14.67 24 17v2h-8" />
        </svg>
      )
    },
    {
      label: "My Clinics",
      path: "/orgs",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M3 10h18M5 10v9h14v-9M9 10V6h6v4" />
        </svg>
      ),
    },
    {
      label: "Sessions", path: "/sessions", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="14" rx="2" strokeWidth="2" />
          <path d="M7 8h10M7 12h6" strokeWidth="2" />
        </svg>
      )
    },
    {
      label: "Calendar", path: "/calendar", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
        </svg>
      )
    },
    {
      label: "Reports & Insights", path: "/reports", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 3v18h18" strokeWidth="2" />
          <path d="M7 15l3-3 3 3 4-6" strokeWidth="2" />
        </svg>
      )
    },
    {
      label: "Payments", path: "/payments", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" />
          <path d="M2 10h20" strokeWidth="2" />
        </svg>
      )
    },
    {
      label: "Notes", path: "/notes", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 4h12l4 4v12H4z" strokeWidth="2" />
          <path d="M16 4v4h4" strokeWidth="2" />
        </svg>
      )
    },
    {
      label: "My Profile", path: "/profile", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="8" r="4" strokeWidth="2" />
          <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" strokeWidth="2" />
        </svg>
      )
    },
    {
      label: "Settings", path: "/settings", icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" strokeWidth="2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.07a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.07c.7 0 1.31-.4 1.51-1z" strokeWidth="1.5" />
        </svg>
      )
    },
  ];

  const isLoadingApp = checking || profileLoading;

  if (isLoadingApp) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />
        <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
          <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-lg backdrop-blur text-center" aria-busy="true" aria-live="polite">
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
      <ScopeRedirectOnChange />
      {/* Background decorative blobs (non-interactive) */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
      {/* ...rest of your layout... */}
      {/* Background decorative blobs (non-interactive) */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />

      {/* Foreground content layer: sidebar + routed pages */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-[90rem] gap-6 p-6">
        <Sidebar
          userEmail={user?.email}
          nav={nav}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          onNavigate={(p) => navigate(p)}
          onLogout={doLogout}
          currentPath={location.pathname}
        />

        {/* Main area: header with switcher + nested routes render here via <Outlet /> */}
        <main className="flex-1 rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
          {/* Top bar: left badge shows scope, right: org switcher */}
          <div className="mb-4 flex items-center justify-between">
            <ScopeBadge />
            <OrgSwitcher />
          </div>

          {/* Page outlet */}
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6">
            <Outlet context={{ welcomeName }} />
          </div>
        </main>
      </div>
    </div>
  );
}
