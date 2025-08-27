import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import {
    collection,
    doc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where,
    writeBatch,
} from "firebase/firestore";

export default function DataRetentionTab() {
    const u = auth.currentUser;

    // 0 = Never delete. Default to 0 unless a value exists in Firestore.
    const [yearsRaw, setYearsRaw] = useState<string>("0");
    const years = Math.max(0, parseInt(yearsRaw || "0", 10) || 0);

    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [info, setInfo] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!u) return;
        const ref = doc(db, "users", u.uid);
        // Load saved retention years (0 = Never)
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any;
            const saved = data?.prefs?.dataRetentionYears as number | undefined;
            if (typeof saved === "number") setYearsRaw(String(saved));
            else setYearsRaw("0"); // default to Never
        });
        return () => unsub();
    }, [u?.uid]);

    async function save() {
        if (!u) return;
        setSaving(true);
        setErr(null);
        setInfo(null);
        try {
            const ref = doc(db, "users", u.uid);
            await setDoc(ref, {}, { merge: true });
            await updateDoc(ref, { "prefs.dataRetentionYears": years });
            setInfo("Saved.");
        } catch (e: any) {
            setErr(e?.message || "Failed to save.");
        } finally {
            setSaving(false);
        }
    }

    async function runCleanupNow() {
        if (!u) return;

        // Confirm destructive action
        const proceed = confirm(
            years === 0
                ? "Retention is set to Never (0). No cleanup will be performed.\nDo you still want to proceed?"
                : `This will permanently delete sessions older than ${years} ${years === 1 ? "year" : "years"} for YOUR account.\nThis cannot be undone.\nContinue?`
        );
        if (!proceed) return;

        if (years === 0) {
            // Explicitly tell the user nothing will be deleted
            setInfo("Retention is set to Never. No cleanup performed.");
            return;
        }

        setRunning(true);
        setErr(null);
        setInfo(null);
        try {
            // Compute cutoff date: sessions older than this are deleted
            const cutoff = new Date();
            cutoff.setFullYear(cutoff.getFullYear() - years);

            const ref = collection(db, "users", u.uid, "sessions");
            const qref = query(ref, where("startAt", "<", cutoff));
            const snap = await getDocs(qref);

            // Batch delete in chunks of 500
            let deleted = 0;
            let batch = writeBatch(db);
            let ops = 0;
            const commits: Promise<void>[] = [];

            snap.forEach((d) => {
                batch.delete(d.ref);
                ops++;
                if (ops === 500) {
                    commits.push(batch.commit());
                    batch = writeBatch(db);
                    ops = 0;
                    deleted += 500;
                }
            });

            if (ops > 0) {
                commits.push(batch.commit());
                deleted += ops;
            }

            await Promise.all(commits);

            setInfo(`Cleanup complete. Deleted ${deleted} old session${deleted === 1 ? "" : "s"}.`);
        } catch (e: any) {
            setErr(e?.message || "Cleanup failed.");
        } finally {
            setRunning(false);
        }
    }

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Data retention</h2>
            <p className="mt-1 text-sm text-slate-600">
                Choose how long to keep old sessions. You can also run a cleanup now.
            </p>

            {/* Retention input: 0 = Never */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-700">Keep sessions for</label>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={yearsRaw}
                    onChange={(e) => setYearsRaw(e.target.value)}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-600">years (0 = Never)</span>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                    {saving ? "Saving…" : "Save"}
                </button>
                <button
                    onClick={runCleanupNow}
                    disabled={running}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                    {running ? "Cleaning…" : "Run cleanup now"}
                </button>
            </div>

            {info && (
                <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {info}
                </div>
            )}
            {err && (
                <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {err}
                </div>
            )}
        </section>
    );
}
