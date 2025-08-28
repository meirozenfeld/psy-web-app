import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useScope } from "../../scope/ScopeContext";
import { useScopedRefs } from "../../scope/path";

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

    const { scope } = useScope();                 // current scope (solo/org)
    const { collection: scopedCol } = useScopedRefs(); // scope-aware ref builder

    const [loading, setLoading] = useState(true);
    const [slow, setSlow] = useState(false);      // optional: UX hint for slow networks
    const [error, setError] = useState<string | null>(null);
    const [latest, setLatest] = useState<Session | null>(null);

    // keep a mounted flag to avoid state updates after unmount
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        // Guards: no identity → nothing to query
        if (!user) {
            setLatest(null);
            setLoading(false);
            setError(null);
            return;
        }
        if (scope.mode === "org" && !scope.orgId) {
            setLatest(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setSlow(false);
        setError(null);

        // Optional "slow network" hint after 2.5s (doesn't change logic)
        const slowTimer = window.setTimeout(() => { if (mountedRef.current) setSlow(true); }, 2500);

        // ✅ Scoped collection:
        // Solo → users/{uid}/sessions
        // Org  → orgs/{orgId}/sessions
        const ref = scopedCol(db, "sessions");

        // ✅ Fetch the single most recent past session: startAt < now, ordered desc, limit 1
        const now = new Date();
        const qref = query(ref, where("startAt", "<", now), orderBy("startAt", "desc"), limit(1));

        const unsub = onSnapshot(
            qref,
            (snap) => {
                if (!mountedRef.current) return;
                const doc = snap.docs[0];
                setLatest(doc ? ({ id: doc.id, ...(doc.data() as Session) }) : null);
                setLoading(false);
            },
            (err) => {
                if (!mountedRef.current) return;
                console.error("LatestEventCard onSnapshot error:", err);
                setError(err?.message || "Failed to load sessions");
                setLatest(null);
                setLoading(false);
            }
        );

        return () => {
            window.clearTimeout(slowTimer);
            unsub();
        };
    }, [user?.uid, scope.mode, scope.orgId]);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-medium text-slate-900">Latest event</h3>

            {loading ? (
                <p className="mt-3 text-sm text-slate-600">
                    {slow ? "Still loading…" : "Loading…"}
                </p>
            ) : error ? (
                <p className="mt-3 text-sm text-rose-700">{error}</p>
            ) : !latest ? (
                <p className="mt-3 text-sm text-slate-600">No past sessions yet.</p>
            ) : (
                <div className="mt-3 rounded-lg border border-slate-200/70 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                        {latest.clientName || "Untitled session"}
                    </p>
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
