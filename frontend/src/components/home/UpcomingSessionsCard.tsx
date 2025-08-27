// UpcomingSessionsCard: shows the next few upcoming sessions (future startAt).
// Firestore path: users/{uid}/sessions
// Notes:
// - Uses a realtime subscription (onSnapshot).
// - Queries ascending by startAt and filters client-side for now>=startAt to avoid composite index.
// - Limits to 5 visible items; add pagination later if needed.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

type Session = {
  id?: string;
  clientId?: string;
  clientName?: string;
  startAt?: any; // Firestore Timestamp
  endAt?: any;   // Firestore Timestamp
  location?: string;
};

export default function UpcomingSessionsCard() {
  const user = auth.currentUser;
  const navigate = useNavigate();

  // Explicit UI states to avoid indefinite loading
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [rows, setRows]       = useState<Session[]>([]);

  useEffect(() => {
    // Defensive: if user is not available, present empty state
    if (!user) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Light query: order by startAt ascending; limit a reasonable window
    // (we still filter for "future" client-side to avoid index/where complexity now)
    const ref  = collection(db, "users", user.uid, "sessions");
    const qref = query(ref, orderBy("startAt", "asc"), limit(50));

    const unsub = onSnapshot(
      qref,
      (snap) => {
        const list: Session[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Session) }));
        setRows(list);
        setLoading(false);
      },
      (err) => {
        // Typical failures: security rules or missing index (if you change the query)
        console.error("Upcoming sessions onSnapshot error:", err);
        setError(err?.message || "Failed to load sessions");
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Keep only upcoming sessions (startAt >= now); take first 5
  const upcoming = useMemo(() => {
    const now = Date.now();
    return rows
      .filter((s) => (s.startAt?.toMillis?.() ?? 0) >= now)
      .slice(0, 5);
  }, [rows]);

  return (
    <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
      {/* Card title */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-slate-900">Upcoming Sessions</h3>
        {/* Secondary action can jump to the full calendar or sessions page */}
        <button
          type="button"
          onClick={() => navigate("/calendar")}
          className="text-xs font-medium text-indigo-700 underline-offset-4 hover:underline"
        >
          View calendar
        </button>
      </div>

      {/* States: loading, error, empty, data */}
      {loading ? (
        <p className="mt-3 text-sm text-slate-600">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-rose-700">{error}</p>
      ) : upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No upcoming sessions.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {upcoming.map((s) => {
            const startMs = s.startAt?.toMillis?.();
            const endMs   = s.endAt?.toMillis?.();
            const start   = startMs ? new Date(startMs) : null;
            const end     = endMs ? new Date(endMs) : null;

            return (
              <li key={s.id} className="flex items-center justify-between py-3">
                {/* Left: session meta */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {s.clientName || "Untitled session"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {start ? start.toLocaleString() : "—"}
                    {end ? ` – ${end.toLocaleTimeString()}` : ""}
                    {s.location ? ` • ${s.location}` : ""}
                  </p>
                </div>

                {/* Right: quick actions */}
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {s.clientId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/clients/${s.clientId}`)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open client
                    </button>
                  )}
                  {/* <button
                    type="button"
                    onClick={() => navigate("/calendar")}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Open calendar
                  </button> */}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
