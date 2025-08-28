// scope/ScopeContext.tsx
// Key fix: listen to Firebase Auth and re-run subscriptions when the user changes.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth"; // <-- type-only (no JS emitted)
import {
    collection, doc, getDoc, onSnapshot, updateDoc, type DocumentData,
} from "firebase/firestore";

type ScopeMode = "solo" | "org";
export type AppScope = { mode: ScopeMode; orgId?: string | null; orgName?: string | null; };
export type MyOrg = { id: string; name: string; role: "owner" | "admin" | "member"; joinedAt?: Date | null; };

type Ctx = {
    scope: AppScope;
    setSolo: () => Promise<void>;
    setOrg: (orgId: string, orgName?: string) => Promise<void>;
    myOrgs: MyOrg[];
    loading: boolean;
    error?: string | null;
};

const ScopeContext = createContext<Ctx | null>(null);

export function ScopeProvider({ children }: { children: React.ReactNode }) {
    // Track the authenticated user explicitly; do NOT rely on auth.currentUser at mount time.
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [scope, setScope] = useState<AppScope>({ mode: "solo" });
    const [myOrgs, setMyOrgs] = useState<MyOrg[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 1) Subscribe to Firebase Auth; this ensures we react when the user becomes available.
    useEffect(() => {
        // NOTE: this fires once immediately with the current user (possibly null), and again on changes.
        const unsub = onAuthStateChanged(auth, (u) => {
            setAuthUser(u);                 // trigger downstream effects
        });
        return () => unsub();
    }, []); // run once

    // 2) Subscribe to the user's profile/scope only when we HAVE a user.
    useEffect(() => {
        if (!authUser) { setScope({ mode: "solo" }); return; }
        const userDocRef = doc(db, "users", authUser.uid);

        // Live subscription to read persisted scope (optional)
        const unsub = onSnapshot(
            userDocRef,
            (snap) => {
                const d = snap.data() as DocumentData | undefined;
                if (d?.scope?.mode === "org" && d?.scope?.orgId) {
                    setScope({ mode: "org", orgId: d.scope.orgId, orgName: d.scope.orgName ?? null });
                } else {
                    setScope({ mode: "solo" });
                }
            },
            (e) => setError(e.message)
        );
        return () => unsub();
    }, [authUser?.uid]); // re-run when user changes
    // (מקביל ללוגיקה הקיימת אצלך, רק תלוי ב־authUser ולא ב־auth.currentUser)  :contentReference[oaicite:9]{index=9}

    // 3) Subscribe to users/{uid}/orgMemberships in real-time when user is ready.
    useEffect(() => {
        if (!authUser) { setMyOrgs([]); setLoading(false); return; }

        setLoading(true);
        setError(null);

        const memCol = collection(db, "users", authUser.uid, "orgMemberships"); // aligned path
        const unsub = onSnapshot(
            memCol,
            async (snap) => {
                try {
                    const rows: MyOrg[] = await Promise.all(
                        snap.docs.map(async (d) => {
                            const { role, joinedAt } = (d.data() as any) || {};
                            const orgId = d.id;

                            // Fetch org name; fallback to "Clinic" if missing
                            const orgRef = doc(db, "orgs", orgId);
                            const orgSnap = await getDoc(orgRef);
                            const name = (orgSnap.exists() && (orgSnap.data() as any).name) || "Clinic";

                            return {
                                id: orgId,
                                name,
                                role: role || "member",
                                joinedAt: joinedAt?.toDate?.() ?? null,
                            };
                        })
                    );
                    setMyOrgs(rows);
                    setLoading(false);
                } catch (e: any) {
                    setError(e.message || "Failed loading org memberships");
                    setLoading(false);
                }
            },
            (e) => { setError(e.message); setLoading(false); }
        );
        return () => unsub();
    }, [authUser?.uid]); // re-run when user changes
    // (זהו אותו ה-hook שהיה, רק עם תלות נכונה ב-authUser)  :contentReference[oaicite:10]{index=10}

    const setSolo = useCallback(async () => {
        setScope({ mode: "solo" });
        if (authUser) await updateDoc(doc(db, "users", authUser.uid), { scope: { mode: "solo" } });
    }, [authUser?.uid]);

    const setOrg = useCallback(async (orgId: string, orgName?: string) => {
        setScope({ mode: "org", orgId, orgName: orgName ?? null });
        if (authUser) await updateDoc(doc(db, "users", authUser.uid), { scope: { mode: "org", orgId, orgName } });
    }, [authUser?.uid]);

    const value = useMemo(() => ({ scope, setSolo, setOrg, myOrgs, loading, error }), [scope, setSolo, setOrg, myOrgs, loading, error]);

    return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
    const ctx = useContext(ScopeContext);
    if (!ctx) throw new Error("useScope must be used within ScopeProvider");
    return ctx;
}
