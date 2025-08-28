// src/components/clinicDetails/ClinicMembersTab.tsx
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../firebase";
import {
    collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where,
    serverTimestamp, setDoc,
    type DocumentData, type QuerySnapshot,
} from "firebase/firestore";
import InviteMemberModal from "./InviteMemberModal";

type Role = "owner" | "admin" | "member";

type MemberRow = {
    userId: string;
    // עדיף לשמור את אלה בדוקומנט של החבר עצמו בזמן ההצטרפות:
    firstName?: string;
    lastName?: string;
    email?: string;
    role: Role;
    addedAt?: any;
};

type InviteRow = {
    id: string;
    email?: string;
    phone?: string;
    role: Role;
    status: "pending" | "accepted" | "revoked" | "expired";
    createdAt?: any;
    createdBy?: string;
    claimedBy?: string;
    claimedEmail?: string;
    claimedFirstName?: string;   // NEW
    claimedLastName?: string;    // NEW
    claimedAt?: any;
};


type UserProfile = {
    firstName?: string;
    lastName?: string;
    email?: string;
};

type SortKey = "first" | "last" | "role";
type SortDir = "asc" | "desc";

export default function ClinicMembersTab({ orgId, orgName = "Clinic" }: { orgId: string; orgName?: string }) {
    const me = auth.currentUser;

    // view state
    const [view, setView] = useState<"members" | "pending">("members");
    const [q, setQ] = useState("");

    // permissions (מהרשומה שלי ב-members)
    const [myRole, setMyRole] = useState<Role | null>(null);
    const canManage = myRole === "owner" || myRole === "admin";

    // data
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [pending, setPending] = useState<InviteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // invite modal
    const [openInvite, setOpenInvite] = useState(false);

    // cache ל־users/{uid} (פולבק בלבד אם אין שדות בדוקומנט של ה-member)
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

    // sort
    const [sortKey, setSortKey] = useState<SortKey>("first");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const toggleSort = (key: SortKey) => {
        setSortKey((prev) => {
            if (prev !== key) {
                setSortDir("asc");
                return key;
            }
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            return prev;
        });
    };

    // Add this helper near your sort state:

    // Explicit setter for sort key + direction (clear and predictable)
    // (English comments are concrete and for the next developer)
    const setSort = (key: SortKey, dir: SortDir) => {
        setSortKey(key);
        setSortDir(dir);
    };

    // Two-arrow sort control: up (asc) and down (desc)
    // Active arrow is highlighted in blue to indicate current column+direction
    const SortControls = ({ col }: { col: SortKey }) => {
        const isActive = sortKey === col;
        const upActive = isActive && sortDir === "asc";
        const downActive = isActive && sortDir === "desc";

        return (
            <span className="ml-1 inline-flex flex-col leading-none select-none">
                {/* Up arrow (ascending) */}
                <button
                    type="button"
                    title="Sort ascending"
                    onClick={(e) => {
                        e.stopPropagation(); // prevent parent clicks
                        setSort(col, "asc");
                    }}
                    className={[
                        "h-3 text-[10px] leading-none",
                        upActive ? "text-sky-600" : "text-slate-400 hover:text-slate-600",
                    ].join(" ")}
                >
                    ▲
                </button>

                {/* Down arrow (descending) */}
                <button
                    type="button"
                    title="Sort descending"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSort(col, "desc");
                    }}
                    className={[
                        "h-3 text-[10px] leading-none -mt-0.5",
                        downActive ? "text-sky-600" : "text-slate-400 hover:text-slate-600",
                    ].join(" ")}
                >
                    ▼
                </button>
            </span>
        );
    };


    async function approveInvite(inv: InviteRow) {
        if (!canManage) return;
        const uid = (inv.claimedBy || "").trim();
        if (!uid) { alert("This invite has not been claimed yet."); return; }

        try {
            const email = (inv.claimedEmail || inv.email || "").trim();
            const firstName = inv.claimedFirstName || "";
            const lastName = inv.claimedLastName || "";

            await setDoc(
                doc(db, "orgs", orgId, "members", uid),
                {
                    userId: uid,
                    email,
                    firstName,
                    lastName,
                    role: inv.role,
                    addedAt: serverTimestamp(),
                },
                { merge: true }
            );

            await setDoc(
                doc(db, "users", uid, "orgMemberships", orgId),
                {
                    orgId,
                    orgName: orgName || "Clinic",
                    role: inv.role,
                    joinedAt: serverTimestamp(),
                },
                { merge: true }
            );

            await updateDoc(doc(db, "orgs", orgId, "invites", inv.id), {
                status: "accepted",
                acceptedAt: serverTimestamp(),
                acceptedBy: me?.uid || null,
                acceptedUserId: uid,
            });
        } catch (e: any) {
            alert(e?.message || "Approve failed");
        }
    }




    // subscribe members + pending
    useEffect(() => {
        setLoading(true);
        setErr(null);

        // members
        const mRef = collection(db, "orgs", orgId, "members");
        const mQ = query(mRef, orderBy("addedAt", "desc"));
        const unsubMembers = onSnapshot(
            mQ,
            (snap: QuerySnapshot<DocumentData>) => {
                const rows: MemberRow[] = [];
                snap.forEach((d) => {
                    const data = d.data() as any;
                    rows.push({
                        userId: data.userId || d.id,
                        firstName: data.firstName || "",
                        lastName: data.lastName || "",
                        email: data.email || "",
                        role: (data.role as Role) || "member",
                        addedAt: data.addedAt,
                    });
                });
                setMembers(rows);

                const mine = rows.find((r) => r.userId === me?.uid);
                setMyRole((mine?.role as Role) || null);
                setLoading(false);
            },
            (e) => {
                console.error(e);
                setErr(e?.message || "Failed to load members");
                setLoading(false);
            }
        );

        // pending invites
        const iRef = collection(db, "orgs", orgId, "invites");
        const iQ = query(iRef, where("status", "==", "pending"));

        const unsubInvites = onSnapshot(
            iQ,
            (snap) => {
                const rows: InviteRow[] = [];
                snap.forEach((d) => {
                    const data = d.data() as any;
                    rows.push({
                        id: d.id,
                        email: data.email || "",
                        phone: data.phone || "",
                        role: (data.role as Role) || "member",
                        status: data.status || "pending",
                        createdAt: data.createdAt,
                        createdBy: data.createdBy,
                        // NEW
                        claimedBy: data.claimedBy || undefined,
                        claimedEmail: data.claimedEmail || undefined,
                        claimedAt: data.claimedAt || undefined,
                        claimedFirstName: data.claimedFirstName || undefined,
                        claimedLastName: data.claimedLastName || undefined,

                    });
                });

                // sort newest first (client-side)
                rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
                setPending(rows);
            }
        );


        return () => {
            unsubMembers();
            unsubInvites();
        };
    }, [orgId, me?.uid]);

    // לאחר ה-useEffect שקורא את profiles, הוסף:
    useEffect(() => {
        if (!canManage) return;
        // עבור כל חבר שחסרים לו first/last/email אבל יש לנו פרופיל ב-cache — נשלים למסמך ה-member
        const needsPatch = members.filter(m => {
            const p = profiles[m.userId] || {};
            const first = m.firstName || p.firstName || "";
            const last = m.lastName || p.lastName || "";
            const mail = m.email || p.email || "";
            return !first || !last || !mail;
        });

        if (needsPatch.length === 0) return;

        (async () => {
            try {
                await Promise.all(needsPatch.map(async (m) => {
                    const p = profiles[m.userId] || {};
                    await setDoc(
                        doc(db, "orgs", orgId, "members", m.userId),
                        {
                            // נכתוב רק מה שחסר כדי לא לדרוס בכוח
                            ...((!m.firstName && p.firstName) ? { firstName: p.firstName } : {}),
                            ...((!m.lastName && p.lastName) ? { lastName: p.lastName } : {}),
                            ...((!m.email && p.email) ? { email: p.email } : {}),
                        },
                        { merge: true }
                    );
                }));
            } catch (_e) {
                // שקט – לא חוסם UI
            }
        })();
    }, [canManage, members, profiles, orgId]);

    // search
    const filteredMembers = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return members;
        return members.filter((m) => {
            const p = profiles[m.userId] || {};
            const first = (m.firstName || p.firstName || "").toLowerCase();
            const last = (m.lastName || p.lastName || "").toLowerCase();
            const mail = (m.email || p.email || "").toLowerCase();
            return (
                first.includes(term) ||
                last.includes(term) ||
                mail.includes(term) ||
                (m.userId || "").toLowerCase().includes(term)
            );
        });
    }, [members, profiles, q]);

    // sort
    const sortedMembers = useMemo(() => {
        const arr = [...filteredMembers];
        const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
        const dir = sortDir === "asc" ? 1 : -1;
        arr.sort((a, b) => {
            const pa = profiles[a.userId] || {};
            const pb = profiles[b.userId] || {};
            const firstA = a.firstName || pa.firstName || "";
            const firstB = b.firstName || pb.firstName || "";
            const lastA = a.lastName || pa.lastName || "";
            const lastB = b.lastName || pb.lastName || "";
            const roleA = a.role || "";
            const roleB = b.role || "";

            let res = 0;
            if (sortKey === "first") res = cmp(firstA, firstB);
            else if (sortKey === "last") res = cmp(lastA, lastB);
            else res = cmp(roleA, roleB);

            if (res !== 0) return dir * res;
            return dir * cmp(a.userId, b.userId);
        });
        return arr;
    }, [filteredMembers, profiles, sortKey, sortDir]);

    // revoke invite
    async function revokeInvite(inviteId: string) {
        if (!canManage) return;
        if (!confirm("Revoke this invite?")) return;
        try {
            const iRef = doc(db, "orgs", orgId, "invites", inviteId);
            await updateDoc(iRef, { status: "revoked" });
        } catch (e: any) {
            alert(e?.message || "Failed to revoke invite");
        }
    }

    const buildMailto = (email: string) => `mailto:${encodeURIComponent(email)}`;

    const SortIcon = ({ col }: { col: SortKey }) => (
        <span className="ml-1 inline-block align-middle text-slate-400">
            {sortKey !== col ? "▲" : sortDir === "asc" ? "▲" : "▼"}
        </span>
    );

    return (
        <div className="max-w-6xl">
            {/* header row */}
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="text-sm text-slate-600">
                    Manage your clinic members and invitations.
                </div>
                {canManage && (
                    <button
                        onClick={() => setOpenInvite(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        Invite member
                    </button>
                )}
            </div>

            {/* tabs + search */}
            <div className="mb-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setView("members")}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium ${view === "members" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                >
                    Members ({members.length})
                </button>
                <button
                    type="button"
                    onClick={() => setView("pending")}
                    className={`rounded-xl px-3 py-1.5 text-sm font-medium ${view === "pending" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                >
                    Pending ({pending.length})
                </button>

                <div className="ml-auto w-full max-w-xs">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={view === "members" ? "Search members…" : "Search pending invites…"}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                    />
                </div>
            </div>

            {/* content */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {loading ? (
                    <div className="flex items-center gap-3 p-4 text-slate-600">
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" className="opacity-25" />
                            <path d="M4 12a8 8 0 0 1 8-8" className="opacity-75" />
                        </svg>
                        <span>Loading…</span>
                    </div>
                ) : err ? (
                    <div className="p-4 text-sm text-rose-700">{err}</div>
                ) : view === "members" ? (
                    sortedMembers.length === 0 ? (
                        <div className="p-6 text-sm text-slate-600">No members found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                                            <button
                                                onClick={() => toggleSort("first")}
                                                className="inline-flex items-center"
                                            >
                                                First name
                                                <SortControls col="first" />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                                            <button
                                                onClick={() => toggleSort("last")}
                                                className="inline-flex items-center"
                                            >
                                                Last name
                                                <SortControls col="last" />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                                            EMAIL
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                                            <button
                                                onClick={() => toggleSort("role")}
                                                className="inline-flex items-center"
                                            >
                                                Role
                                                <SortControls col="role" />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {sortedMembers.map((m) => {
                                        const p = profiles[m.userId] || {};
                                        const first = m.firstName || p.firstName || "";
                                        const last = m.lastName || p.lastName || "";
                                        const mail = m.email || p.email || "";
                                        return (
                                            <tr key={m.userId} className="hover:bg-slate-50/60">
                                                <td className="px-4 py-3"><div className="font-medium text-slate-900">{first || "—"}</div></td>
                                                <td className="px-4 py-3"><div className="font-medium text-slate-900">{last || "—"}</div></td>
                                                <td className="px-4 py-3 text-slate-700">
                                                    {mail ? (
                                                        <button
                                                            className="underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
                                                            onClick={() => { window.location.href = buildMailto(mail); }}
                                                        >
                                                            {mail}
                                                        </button>

                                                    ) : "—"}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700">{m.role}</td>
                                                <td className="px-4 py-3 space-x-2 text-right">
                                                    {canManage && m.userId !== me?.uid && (
                                                        <button
                                                            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                                            onClick={async () => {
                                                                if (!confirm("Remove this member from the clinic?")) return;
                                                                await updateDoc(doc(db, "orgs", orgId, "members", m.userId), { role: "member" }); // או מחיקה אם תרצה
                                                                // לדוגמה למחיקה: await deleteDoc(doc(db, "orgs", orgId, "members", m.userId))
                                                            }}
                                                            title="Remove / demote"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : pending.length === 0 ? (
                    <div className="p-6 text-sm text-slate-600">No pending invites.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Invite</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Role</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-600">Created</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pending.map((i) => (
                                    <tr key={i.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3"><div className="font-medium text-slate-900">{i.email || i.phone || "Invite"}</div></td>
                                        <td className="px-4 py-3 text-slate-700">{i.role}</td>
                                        <td className="px-4 py-3 text-slate-700">{i.createdAt?.toDate ? i.createdAt.toDate().toLocaleString() : "—"}</td>
                                        <td className="px-4 py-3 space-x-2 text-right">
                                            {canManage && (
                                                <>
                                                    {!i.claimedBy ? (
                                                        <span className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed">
                                                            Waiting
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => approveInvite(i)}
                                                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => revokeInvite(i.id)}
                                                        className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                                    >
                                                        Revoke
                                                    </button>
                                                </>
                                            )}
                                        </td>


                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Invite modal */}
            {openInvite && canManage && (
                <InviteMemberModal
                    open={openInvite}
                    canManage={canManage}
                    orgId={orgId}
                    orgName={orgName}
                    onClose={() => setOpenInvite(false)}
                />

            )}
        </div>
    );
}
