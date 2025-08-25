// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { app, auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

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

  const doLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (e) {
      console.error("Logout error", e);
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-100 shadow-lg p-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-widest">WELCOME</h1>
        {user?.email && (
          <p className="mt-2 text-sm text-slate-500">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        )}

        <button
          onClick={doLogout}
          className="mt-6 w-full rounded-xl bg-slate-800 text-white py-2.5 font-medium hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
