// RemindersCard: realtime reminders list with proper loading/error states.
// Firestore path: users/{uid}/reminders
// Notes:
// - Adds an explicit `loading` and `error` state so UI won't stick on "Loading...".
// - Includes onSnapshot error callback to surface permission/index issues.

import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

type Reminder = {
    id?: string;
    title: string;
    dueAt?: any;       // Firestore Timestamp
    done?: boolean;
    createdAt?: any;
    updatedAt?: any;
};

export default function RemindersCard() {
    // Read current user once; AppLayout guards this page, so user should exist here.
    const user = auth.currentUser;

    // Track loading and error explicitly instead of deriving from `items === null`.
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<Reminder[]>([]);

    useEffect(() => {
        // If for any reason user is not ready, present empty state quickly.
        if (!user) {
            setItems([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        // Use createdAt for stable base order; further sort by dueAt client-side.
        const ref = collection(db, "users", user.uid, "reminders");
        const qref = query(ref, orderBy("createdAt", "desc"));

        // Subscribe to realtime updates; include error callback.
        const unsub = onSnapshot(
            qref,
            (snap) => {
                const rows: Reminder[] = [];
                snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Reminder) }));

                // Sort by dueAt ascending; items without dueAt go last.
                rows.sort((a, b) => {
                    const at = a.dueAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
                    const bt = b.dueAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
                    return at - bt;
                });

                setItems(rows);
                setLoading(false);
            },
            (err) => {
                // Common cases: security rules block, or missing required index.
                console.error("Reminders onSnapshot error:", err);
                setError(err?.message || "Failed to load reminders");
                setItems([]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [user?.uid]);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-medium text-slate-900">Reminders</h3>

            {/* Loading/Error/Empty/Data states */}
            {loading ? (
                <p className="mt-3 text-sm text-slate-600">Loading…</p>
            ) : error ? (
                <p className="mt-3 text-sm text-rose-700">{error}</p>
            ) : items.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No reminders yet.</p>
            ) : (
                <ul className="mt-3 space-y-2">
                    {/* Keep the card compact by limiting visible items */}
                    {items.slice(0, 6).map((r) => (
                        <li
                            key={r.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200/70 px-3 py-2"
                        >
                            <div className="min-w-0">
                                <p className="truncate text-sm text-slate-800">{r.title}</p>
                                {r.dueAt && (
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        Due {new Date(r.dueAt.toMillis()).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            {r.done ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                    Done
                                </span>
                            ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                                    Pending
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
