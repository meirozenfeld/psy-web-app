// src/pages/AcceptInvite.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const PENDING_INVITE_KEY = "pendingInvitePath";

export default function AcceptInvite() {
    const { token } = useParams<{ token: string }>();
    const [sp] = useSearchParams();
    const orgId = sp.get("org") || "";
    const navigate = useNavigate();
    const loc = useLocation();

    const [busy, setBusy] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    // Build the exact invite path (used for next= and localStorage)
    const invitePath = useMemo(() => {
        return token && orgId ? `/invite/${encodeURIComponent(token)}?org=${encodeURIComponent(orgId)}` : "";
    }, [token, orgId]);

    useEffect(() => {
        let unsub = () => { };
        async function run() {
            setErr(null);
            setInfo(null);

            if (!token || !orgId) {
                setErr("Invalid invite link.");
                setBusy(false);
                return;
            }

            // Persist deep-link so Login/Signup can send the user back here
            if (invitePath) {
                localStorage.setItem(PENDING_INVITE_KEY, invitePath);
            }

            // Require sign-in before claiming
            unsub = onAuthStateChanged(auth, async (u) => {
                if (!u) {
                    setBusy(false);
                    setErr("Please sign in to accept the invitation.");
                    return;
                }

                try {
                    setBusy(true);

                    // 1) Resolve inviteId from the public token (public read allowed by rules)
                    const tokRef = doc(db, "orgs", orgId, "inviteTokens", token);
                    const tokSnap = await getDoc(tokRef);
                    if (!tokSnap.exists()) {
                        setErr("Invite token not found or expired.");
                        setBusy(false);
                        return;
                    }
                    const { inviteId } = tokSnap.data() as { inviteId?: string };
                    if (!inviteId) {
                        setErr("Malformed invite token.");
                        setBusy(false);
                        return;
                    }

                    // 2) Read the invite doc so שנוכל לשלוח חזרה גם את שדות הליבה ב-update
                    const inviteRef = doc(db, "orgs", orgId, "invites", inviteId);
                    const invSnap = await getDoc(inviteRef);
                    if (!invSnap.exists()) {
                        setErr("Invite not found.");
                        setBusy(false);
                        return;
                    }
                    const inv = invSnap.data() as any;

                    // הגנות רכות בצד לקוח – לא חובה, אבל משפר UX
                    if (inv.status && inv.status !== "pending") {
                        setErr("This invitation is not pending anymore.");
                        setBusy(false);
                        return;
                    }

                    // אם ההזמנה נקשרה למייל – נוודא בצד לקוח התאמה
                    const myEmail = (u.email || "").trim().toLowerCase() || null;
                    const inviteEmailLC =
                        inv.email_lc ?? (typeof inv.email === "string" ? inv.email.trim().toLowerCase() : null);
                    if (inviteEmailLC && myEmail && inviteEmailLC !== myEmail) {
                        setErr("This invitation is addressed to a different email.");
                        setBusy(false);
                        return;
                    }

                    // 3) Collect profile (לא חובה, רק לשמות)
                    let claimedFirstName: string | null = null;
                    let claimedLastName: string | null = null;
                    try {
                        const profileSnap = await getDoc(doc(db, "users", u.uid));
                        if (profileSnap.exists()) {
                            const p = profileSnap.data() as any;
                            claimedFirstName = p.firstName || null;
                            claimedLastName = p.lastName || null;
                        }
                    } catch {
                        // ignore profile errors
                    }
                    if (!claimedFirstName || !claimedLastName) {
                        const parts = (u.displayName || "").trim().split(" ").filter(Boolean);
                        claimedFirstName = claimedFirstName || (parts[0] || null);
                        claimedLastName = claimedLastName || (parts.slice(1).join(" ") || null);
                    }

                    // 4) UPDATE עם merge "מלא": שולחים גם את שדות הליבה הלא־ניתנים לשינוי לפי ה-Rules
                    await updateDoc(inviteRef, {
                        // שדות claim חדשים
                        claimedBy: u.uid,
                        claimedEmail: myEmail,
                        claimedEmail_lc: myEmail,
                        claimedFirstName,
                        claimedLastName,
                        claimedAt: serverTimestamp(),

                        // ===== חשובים כדי שה-Rules יעברו (לא משנים ערכים) =====
                        role: inv.role ?? "member",
                        email: inv.email ?? null,
                        phone: inv.phone ?? null,
                        createdBy: inv.createdBy,
                        status: inv.status ?? "pending",
                    });

                    setInfo("Invitation claimed successfully. An admin can now approve you.");
                    setBusy(false);

                    // בכוונה לא מעבירים דף – שיראה את ההצלחה.
                } catch (e: any) {
                    console.error(e);
                    setErr(e?.message || "Could not process invitation. Please try again.");
                    setBusy(false);
                }
            });
        }
        run();
        return () => unsub();
    }, [token, orgId, invitePath]);

    // Build login/signup links with next= param as a fallback even if localStorage fails
    const nextParam = invitePath ? `?next=${encodeURIComponent(invitePath)}` : "";

    return (
        <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
            <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow">
                <h1 className="text-xl font-semibold text-slate-900">Join Clinic</h1>
                <p className="mt-1 text-sm text-slate-600">Accept your invitation to join the clinic.</p>

                {busy && <div className="mt-4 text-slate-700">Processing…</div>}

                {!busy && err && (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {err}
                    </div>
                )}

                {!busy && info && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {info}
                    </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                    {/* כשהמשתמש לא מחובר – להציג Sign in + Sign up (עם next=) */}
                    {!busy && err && (
                        <>
                            <button
                                onClick={() => navigate(`/login${nextParam}`)}
                                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                            >
                                Sign in
                            </button>
                            <button
                                onClick={() => navigate(`/signup${nextParam}`)}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Sign up
                            </button>
                        </>
                    )}

                    {/* אחרי claim מוצלח – רק Go home */}
                    {!busy && info && (
                        <button
                            onClick={() => navigate("/")}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Go home
                        </button>
                    )}
                </div>

                {/* עזרה לפיתוח: הראה את ה-path שחוזרים אליו לאחר התחברות */}
                {process.env.NODE_ENV === "development" && invitePath && (
                    <div className="mt-3 text-[11px] text-slate-500">
                        Debug next: <code className="font-mono">{invitePath}</code>
                    </div>
                )}
            </div>
        </div>
    );
}
