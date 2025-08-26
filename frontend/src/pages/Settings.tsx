// Settings page: account security (password) and account deletion flows
import { useState } from "react";
import { auth, db } from "../firebase";
import {
    deleteUser,
    EmailAuthProvider,
    GoogleAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    updatePassword,
    linkWithCredential,
} from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Settings() {
    const navigate = useNavigate();

    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Used when the user is signed in with the password provider
    const [password, setPassword] = useState("");
    // Change-password UI state
    const [pwLoading, setPwLoading] = useState(false);
    const [pwErr, setPwErr] = useState<string | null>(null);
    const [pwInfo, setPwInfo] = useState<string | null>(null);

    // Reuse the existing 'password' state in the deletion flow to avoid duplication.
    // If preferred, keep a separate state for the current password field:

    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const handleChangePassword = async () => {
        setPwErr(null);
        setPwInfo(null);

        const u = auth.currentUser;
        if (!u) {
            setPwErr("You are not signed in.");
            return;
        }

        // Basic validation
        if (!newPw || newPw.length < 6) {
            setPwErr("New password must be at least 6 characters.");
            return;
        }
        if (newPw !== confirmPw) {
            setPwErr("New password and confirmation do not match.");
            return;
        }

        setPwLoading(true);
        try {
            const providerIds = (u.providerData || []).map((p) => p.providerId);
            const hasPasswordProvider = providerIds.includes("password");
            const hasGoogleProvider = providerIds.includes("google.com");

            if (hasPasswordProvider) {
                // Flow: email+password user — requires reauthentication with current password
                if (!u.email) throw new Error("Missing email on current user.");
                if (!currentPw.trim()) {
                    setPwErr("Please enter your current password.");
                    setPwLoading(false);
                    return;
                }
                if (currentPw === newPw) {
                    setPwErr("New password must be different from the current password.");
                    setPwLoading(false);
                    return;
                }

                const cred = EmailAuthProvider.credential(u.email, currentPw);
                await reauthenticateWithCredential(u, cred);
                await updatePassword(u, newPw);
                setPwInfo("Your password has been updated.");
                setCurrentPw("");
                setNewPw("");
                setConfirmPw("");
            } else if (hasGoogleProvider) {
                // Flow: Google-only account — set the first password
                // Reauthenticate with Google, then link an Email+Password credential with the new password
                if (!u.email) throw new Error("Your Google account has no email.");
                const g = new GoogleAuthProvider();
                await reauthenticateWithPopup(u, g);

                const emailCred = EmailAuthProvider.credential(u.email, newPw);
                await linkWithCredential(u, emailCred);

                // After linkWithCredential, the user can also sign in with email & password
                setPwInfo("Password has been set for your account. You can now sign in using email & password.");
                setNewPw("");
                setConfirmPw("");
            } else {
                // Other provider — show a neutral message, or attempt updatePassword after reauth if supported
                setPwErr("Changing password for this sign-in method is not supported here.");
            }
        } catch (e: any) {
            const code = e?.code || "";
            if (code === "auth/wrong-password") {
                setPwErr("Current password is incorrect.");
            } else if (code === "auth/requires-recent-login") {
                setPwErr("For security reasons, please sign in again and retry.");
            } else if (code === "auth/credential-already-in-use") {
                // Happens if another account already uses this email+password (rare in this flow)
                setPwErr("This email is already linked to a password. Try signing in with email & password.");
            } else {
                setPwErr(e?.message || "Failed to change password. Please try again.");
            }
        } finally {
            setPwLoading(false);
        }
    };

    const startDeleteFlow = () => {
        setErr(null);
        setConfirming(true);
    };

    const cancelDelete = () => {
        setErr(null);
        setPassword("");
        setConfirming(false);
    };

    const handleDelete = async () => {
        setErr(null);
        setLoading(true);

        try {
            const u = auth.currentUser;
            if (!u) {
                navigate("/login", { replace: true });
                return;
            }
            // Step 1: Reauthentication (required by Firebase)
            // Check sign-in provider — Google or password
            const providerIds = (u.providerData || []).map((p) => p.providerId);

            if (providerIds.includes("google.com")) {
                // Google sign-in — reauthenticate via popup
                const g = new GoogleAuthProvider();
                await reauthenticateWithPopup(u, g);
            } else if (providerIds.includes("password")) {
                // Email+password sign-in — require the user's password
                if (!u.email) {
                    throw new Error("Missing email on current user.");
                }
                if (!password.trim()) {
                    setLoading(false);
                    setErr("Please enter your password to confirm.");
                    return;
                }
                const cred = EmailAuthProvider.credential(u.email, password);
                await reauthenticateWithCredential(u, cred);
            } else {
                // Other/unknown provider — proceed; Firebase will error if recent login is required
            }

            // Step 2: Delete user data from Firestore
            // Remove the user document; for related data (clients/sessions/notes), prefer a server-side purge (Cloud Functions)

            try {
                await deleteDoc(doc(db, "users", u.uid));
            } catch (e) {
                // Do not abort the flow if the doc is missing or permissions block deletion
                console.warn("Firestore user doc delete warning:", e);
            }

            // Step 3: Delete the user from Auth
            await deleteUser(u);

            // Step 4: Redirect out
            navigate("/login", { replace: true });
        } catch (e: any) {
            const code = e?.code || "";
            if (code === "auth/requires-recent-login") {
                setErr("For security reasons, please sign in again and then retry account deletion.");
            } else if (code === "auth/popup-closed-by-user") {
                setErr("Google re-authentication was canceled.");
            } else if (code === "auth/wrong-password") {
                setErr("Incorrect password. Please try again.");
            } else {
                setErr(e?.message || "Could not delete your account. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your account and preferences.</p>
            {/* Account security section */}
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Account security</h2>
                <p className="mt-1 text-sm text-slate-600">Manage your password.</p>

                {/* If the user has the password provider, show the current-password field */}
                {auth.currentUser?.providerData?.some((p) => p.providerId === "password") ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-slate-700">Current password</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? "text" : "password"}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                                    placeholder="••••••••"
                                    value={currentPw}
                                    onChange={(e) => setCurrentPw(e.target.value)}
                                    disabled={pwLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent((s) => !s)}
                                    className="absolute inset-y-0 right-2.5 my-auto rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    aria-label={showCurrent ? "Hide password" : "Show password"}
                                >
                                    {showCurrent ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-3.42M9.88 5.51A9.94 9.94 0 0112 5c5.52 0 10 4.48 10 7 0 1.02-.47 2.02-1.31 2.99M6.1 6.1C3.98 7.46 2 9.52 2 12c0 2.52 4.48 7 10 7" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                            <div className="relative">
                                <input
                                    type={showNew ? "text" : "password"}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                                    placeholder="At least 6 characters"
                                    value={newPw}
                                    onChange={(e) => setNewPw(e.target.value)}
                                    disabled={pwLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew((s) => !s)}
                                    className="absolute inset-y-0 right-2.5 my-auto rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    aria-label={showNew ? "Hide password" : "Show password"}
                                >
                                    {showNew ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-3.42M9.88 5.51A9.94 9.94 0 0112 5c5.52 0 10 4.48 10 7 0 1.02-.47 2.02-1.31 2.99M6.1 6.1C3.98 7.46 2 9.52 2 12c0 2.52 4.48 7 10 7" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? "text" : "password"}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Re-type new password"
                                    value={confirmPw}
                                    onChange={(e) => setConfirmPw(e.target.value)}
                                    disabled={pwLoading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm((s) => !s)}
                                    className="absolute inset-y-0 right-2.5 my-auto rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    aria-label={showConfirm ? "Hide password" : "Show password"}
                                >
                                    {showConfirm ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-3.42M9.88 5.51A9.94 9.94 0 0112 5c5.52 0 10 4.48 10 7 0 1.02-.47 2.02-1.31 2.99M6.1 6.1C3.98 7.46 2 9.52 2 12c0 2.52 4.48 7 10 7" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                ) : (
                    // Google-only sign-in — set the first password
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
                            Your account is signed in with Google. You can set a password to enable email & password sign-in as well.
                        </div>
                        <div className="sm:col-span-1">
                            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                            <input
                                type="password"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                                placeholder="At least 6 characters"
                                value={newPw}
                                onChange={(e) => setNewPw(e.target.value)}
                                disabled={pwLoading}
                            />
                        </div>
                        <div className="sm:col-span-1">
                            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
                            <input
                                type="password"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                                placeholder="Re-type new password"
                                value={confirmPw}
                                onChange={(e) => setConfirmPw(e.target.value)}
                                disabled={pwLoading}
                            />
                        </div>
                    </div>
                )}

                {/* Password flow: error/info banners */}
                {pwErr && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                        {pwErr}
                    </div>
                )}
                {pwInfo && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
                        {pwInfo}
                    </div>
                )}

                <div className="mt-4">
                    <button
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow hover:bg-indigo-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                    >
                        {pwLoading ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeWidth="2" d="M12 1v22M5 8l7-7 7 7" />
                                </svg>
                                Change password
                            </>
                        )}
                    </button>
                </div>
            </section>

            {/* Danger zone: irreversible account deletion */}
            <section className="mt-8 rounded-2xl border border-rose-200/70 bg-rose-50/60 p-6">
                <h2 className="text-lg font-semibold text-rose-900">Danger zone</h2>
                <p className="mt-1 text-sm text-rose-800">
                    Deleting your account is permanent. This will remove your profile and all associated data.
                </p>

                {!confirming ? (
                    <button
                        onClick={startDeleteFlow}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-white shadow hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-600"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="2" d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4h4v2" />
                        </svg>
                        Delete my account
                    </button>
                ) : (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                        <p className="text-sm text-slate-800">
                            Are you sure you want to permanently delete your account? This action cannot be undone.
                        </p>

                        {/* If signed in with password, request password for reauthentication */}
                        {auth.currentUser?.providerData?.some((p) => p.providerId === "password") && (
                            <div className="mt-3">
                                <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
                                <input
                                    type="password"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    For security, please re-enter your password.
                                </p>
                            </div>
                        )}

                        {err && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                                {err}
                            </div>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-white shadow hover:bg-rose-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-600"
                            >
                                {loading ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                        Deleting…
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path strokeWidth="2" d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4h4v2" />
                                        </svg>
                                        Yes, delete permanently
                                    </>
                                )}
                            </button>
                            <button
                                onClick={cancelDelete}
                                disabled={loading}
                                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Technical note about fully deleting user-related content */}
            <p className="mt-3 text-xs text-slate-500">
                Note: To guarantee deletion of all related content (clients, sessions, notes…), consider handling it on the server
                with a Cloud Function using the Admin SDK, or store all user data under <code>users/&lt;uid&gt;</code> subcollections
                and delete them there.
            </p>
        </>
    );
}
