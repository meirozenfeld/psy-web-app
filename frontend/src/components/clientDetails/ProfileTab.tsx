// components/clientDetails/ProfileTab.tsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import {
    doc, getDoc, updateDoc, serverTimestamp, deleteDoc,
    type DocumentData
} from "firebase/firestore";
import { useScopedRefs } from "../../scope/path"; // <-- use scope-aware builders

type Client = {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    status?: "active" | "paused" | "archived";
    createdAt?: any;
    updatedAt?: any;
};

type Props = {
    clientId: string;
    onError: (msg: string) => void;
    onNameChange?: (fullName: string) => void;
    onDeleted?: () => void;
};

export default function ProfileTab({ clientId, onError, onNameChange, onDeleted }: Props) {
    const user = auth.currentUser;
    const { doc: scopedDoc } = useScopedRefs();  // <-- scope-aware doc()

    // Local form state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [status, setStatus] = useState<Client["status"]>("active");

    // ✅ Load client from the correct collection based on current scope:
    //    - Solo: users/{uid}/clients/{clientId}
    //    - Org : orgs/{orgId}/clients/{clientId}
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!user?.uid || !clientId) return;
            try {
                const ref = scopedDoc(db, "clients", clientId); // <-- key change
                const snap = await getDoc(ref);
                if (!alive) return;
                if (!snap.exists()) {
                    onError("Client not found.");
                    return;
                }
                const c = snap.data() as Client;
                setFirstName(c.firstName || "");
                setLastName(c.lastName || "");
                setEmail(c.email || "");
                setPhone(c.phone || "");
                setStatus(c.status || "active");
                onNameChange?.(`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim());
            } catch (e: any) {
                onError(e?.message || "Failed to load client");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [user?.uid, clientId, scopedDoc]); // <-- re-run if scope changes

    // ✅ Save to the correct place (solo/org)
    const onSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.uid || !clientId) return;
        setSaving(true);
        try {
            const ref = scopedDoc(db, "clients", clientId); // <-- key change
            const payload = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                status,
                updatedAt: serverTimestamp(),
            };
            await updateDoc(ref, payload);
            onNameChange?.(`${payload.firstName} ${payload.lastName}`.trim());
        } catch (e: any) {
            onError(e?.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    // ✅ Delete from the correct place (solo/org)
    const onDelete = async () => {
        if (!user?.uid || !clientId) return;
        if (!confirm("Delete this client? This cannot be undone.")) return;
        try {
            const ref = scopedDoc(db, "clients", clientId); // <-- key change
            await deleteDoc(ref);
            onDeleted?.();
        } catch (e: any) {
            onError(e?.message || "Failed to delete");
        }
    };

    if (loading) return <p className="text-sm text-slate-600">Loading client…</p>;

    return (
        <form onSubmit={onSave} className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* Basic identity fields */}
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">First name</label>
                <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                />
            </div>
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Last name</label>
                <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                />
            </div>
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
            </div>
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
            </div>
            <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Client["status"])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            <div className="mt-2 flex items-center gap-3 sm:col-span-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                    Delete client
                </button>
            </div>
        </form>
    );
}
