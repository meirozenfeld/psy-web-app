// LatestEventCard: shows the next upcoming session (or latest past) with solid loading/error states.
// Firestore path: users/{uid}/sessions
// Notes:
// - Adds `loading` and `error` to avoid indefinite "Loading...".
// - onSnapshot includes error callback to surface rules/index issues.

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

type Session = {
    id?: string;
    clientId?: string;
    clientName?: string;
    startAt?: any; // Firestore Timestamp
    endAt?: any;   // Firestore Timestamp
    location?: string;
};

export default function LatestEventCard() {
    const user = auth.currentUser;
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<Session[]>([]);

    useEffect(() => {
        if (!user) {
            setRows([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        // Ascending by startAt; limit keeps the card light.
        const ref = collection(db, "users", user.uid, "sessions");
        const qref = query(ref, orderBy("startAt", "asc"), limit(20));

        const unsub = onSnapshot(
            qref,
            (snap) => {
                const list: Session[] = [];
                snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Session) }));
                setRows(list);
                setLoading(false);
            },
            (err) => {
                console.error("Sessions onSnapshot error:", err);
                setError(err?.message || "Failed to load sessions");
                setRows([]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [user?.uid]);

    // Strict past-only: pick the most recent session that has already happened.
    // If none exists, return null (the UI will show "No past sessions yet.")
    const latest = useMemo(() => {
        if (rows.length === 0) return null;

        const now = Date.now();

        // Helper: decide "past" using endAt when available, otherwise startAt
        const isPast = (s: Session) => {
            const endMs = s.endAt?.toMillis?.();
            const startMs = s.startAt?.toMillis?.();
            // If end time exists, treat as past only if it ended already
            if (typeof endMs === "number") return endMs < now;
            // If no end time, use start time
            if (typeof startMs === "number") return startMs < now;
            return false;
        };

        // Scan from the end (rows are ascending by startAt)
        for (let i = rows.length - 1; i >= 0; i--) {
            if (isPast(rows[i])) return rows[i];
        }

        // No past sessions at all
        return null;
    }, [rows]);



    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-medium text-slate-900">Latest event</h3>

            {loading ? (
                <p className="mt-3 text-sm text-slate-600">Loading…</p>
            ) : error ? (
                <p className="mt-3 text-sm text-rose-700">{error}</p>
            ) : !latest ? (
                <p className="mt-3 text-sm text-slate-600">No past sessions yet.</p>
            )
                : (
                    <div className="mt-3 rounded-lg border border-slate-200/70 bg-white px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                            {latest.clientName || "Untitled session"}
                        </p>

                        {/* Show readable date/time; only show end time when available */}
                        <p className="mt-1 text-sm text-slate-600">
                            {latest.startAt?.toMillis
                                ? new Date(latest.startAt.toMillis()).toLocaleString()
                                : "—"}
                            {latest.endAt?.toMillis
                                ? ` – ${new Date(latest.endAt.toMillis()).toLocaleTimeString()}`
                                : ""}
                        </p>

                        {latest.location && (
                            <p className="mt-1 text-xs text-slate-500">Location: {latest.location}</p>
                        )}

                        {/* Quick actions */}
                        <div className="mt-3 flex items-center gap-2">
                            {latest.clientId && (
                                <button
                                    onClick={() => navigate(`/clients/${latest.clientId}`)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Open client
                                </button>
                            )}
                            <button
                                onClick={() => navigate("/calendar")}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                                Open calendar
                            </button>
                        </div>
                    </div>
                )}
        </div>
    );
}
