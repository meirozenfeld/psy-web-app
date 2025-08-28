import { useState } from "react";
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { upsertEmailIndex } from "../utils/emailIndex";

export default function Login() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();
    const PENDING_INVITE_KEY = "pendingInvitePath";
    const AFTER_ONBOARDING_NEXT = "afterOnboardingNext";
    const nextParam = sp.get("next");

    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    // After successful sign-in: ensure user doc exists, then redirect
    const postAuthRedirect = async (user: User) => {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        // פונקציה קטנה לשמירת יעד לאחר Onboarding
        const stashNextAndGoToOnboarding = () => {
            const next =
                sp.get("next") ||
                localStorage.getItem(PENDING_INVITE_KEY) ||
                null;
            if (next) {
                localStorage.setItem(AFTER_ONBOARDING_NEXT, next);
                localStorage.removeItem(PENDING_INVITE_KEY);
            }
            navigate("/onboarding", { replace: true });
        };

        if (!snap.exists()) {
            // משתמש חדש – צור מסמך ואז שלח ל-Onboarding (לא לעמוד ההזמנה!)
            const display = user.displayName || "";
            const parts = display.trim().split(" ");
            const firstName = parts[0] || "";
            const lastName = parts.slice(1).join(" ");

            await setDoc(
                ref,
                {
                    email: user.email || "",
                    firstName,
                    lastName,
                    hasCompletedOnboarding: false,
                    authProvider: user.providerData?.[0]?.providerId || "password",
                    createdAt: serverTimestamp(),
                },
                { merge: true }
            );

            await upsertEmailIndex({
                uid: user.uid,
                email: user.email,
                firstName,
                lastName,
            });

            // תמיד קודם Onboarding, ושומרים את היעד אם יש
            stashNextAndGoToOnboarding();
            return;
        }

        // משתמש קיים
        const data = snap.data() as {
            hasCompletedOnboarding?: boolean;
            firstName?: string;
            lastName?: string;
            email?: string;
        };

        await upsertEmailIndex({
            uid: user.uid,
            email: data.email ?? user.email ?? undefined,
            firstName: data.firstName,
            lastName: data.lastName,
        });

        if (!data?.hasCompletedOnboarding) {
            // עדיין לא השלים Onboarding → קודם Onboarding
            stashNextAndGoToOnboarding();
            return;
        }

        // השלים Onboarding → אפשר לכבד next ולחזור להזמנה
        const next = sp.get("next") || localStorage.getItem(PENDING_INVITE_KEY);
        if (next) {
            localStorage.removeItem(PENDING_INVITE_KEY);
            navigate(next, { replace: true });
            return;
        }

        navigate("/", { replace: true });
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr(null);
        setInfo(null);
        setLoading(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
            await postAuthRedirect(cred.user);
        } catch (e: any) {
            const code = e?.code || "";
            if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
                setErr("Incorrect email or password.");
            } else if (code === "auth/user-not-found") {
                setErr("No user found with this email.");
            } else if (code === "auth/invalid-email") {
                setErr("Invalid email address.");
            } else {
                setErr("Sign-in failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const onGoogle = async () => {
        setErr(null);
        setInfo(null);
        setLoading(true);
        try {
            const cred = await signInWithPopup(auth, googleProvider);
            await postAuthRedirect(cred.user);
        } catch (e: any) {
            if (e?.code === "auth/popup-closed-by-user") {
                setErr("Google sign-in was closed before completing.");
            } else {
                setErr("Google sign-in failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const onForgotPassword = async () => {
        setErr(null);
        setInfo(null);
        const mail = email.trim();
        if (!mail) {
            setErr("Please enter your email first to reset your password.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, mail);
            setInfo("A password reset email has been sent. Check your inbox (and spam).");
        } catch (e: any) {
            const code = e?.code || "";
            if (code === "auth/invalid-email") {
                setErr("Invalid email address.");
            } else if (code === "auth/user-not-found") {
                setInfo("If an account exists for this email, a reset link was sent.");
            } else {
                setErr("Could not send reset email. Please try again.");
            }
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50">
            {/* Background decorative blobs (non-interactive) */}
            <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/60 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />

            {/* Centered login card container */}
            <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
                <div className="w-full max-w-md">
                    {/* Brand logo and heading */}
                    <div className="mb-6 flex flex-col items-center text-center">
                        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg">
                            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12s2-5 9-5 9 5 9 5-2 5-9 5-9-5-9-5z" />
                                <path d="M12 8l1.5 3h3L13 15l-1.5-3h-3L12 8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign In</h1>
                        <p className="mt-1 text-sm text-slate-600">Sign in to your Psy Web-App account</p>
                    </div>

                    {/* Login form card */}
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur">
                        <form className="space-y-5" onSubmit={onSubmit} noValidate>
                            {/* Email input */}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                                        <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M4 4h16v16H4z" />
                                            <path d="M22 6l-10 7L2 6" />
                                        </svg>
                                    </span>
                                    <input
                                        type="email"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        autoComplete="username"
                                        required
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            {/* Password input with toggle and forgot-password link */}
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="block text-sm font-medium text-slate-700">Password</label>
                                    {/* Forgot password link triggers reset email flow */}
                                    <button
                                        type="button"
                                        onClick={onForgotPassword}
                                        className="text-xs font-medium text-sky-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-500 rounded"
                                    >
                                        Forgot password?
                                    </button>
                                </div>

                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                                        <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="10" rx="2" />
                                            <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                                        </svg>
                                    </span>
                                    <input
                                        type={showPass ? "text" : "password"}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2.5 pr-12 shadow-sm outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500"
                                        value={pass}
                                        onChange={(e) => setPass(e.target.value)}
                                        autoComplete="current-password"
                                        required
                                        minLength={6}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass((s) => !s)}
                                        className="absolute inset-y-0 right-2.5 my-auto rounded-md p-2 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        aria-label={showPass ? "Hide password" : "Show password"}
                                        title={showPass ? "Hide password" : "Show password"}
                                    >
                                        {showPass ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="2" d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-3.42M9.88 5.51A9.94 9.94 0 0112 5c5.52 0 10 4.48 10 7 0 1.02-.47 2.02-1.31 2.99M6.1 6.1C3.98 7.46 2 9.52 2 12c0 2.52 4.48 7 10 7 1.49 0 2.89-.29 4.09-.8" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="2" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                                                <circle cx="12" cy="12" r="3" strokeWidth="2" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Error and info banners */}
                            {err && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
                                    {err}
                                </div>
                            )}
                            {info && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status" aria-live="polite">
                                    {info}
                                </div>
                            )}

                            {/* Submit button (sign in) */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full overflow-hidden rounded-xl bg-sky-600 py-2.5 font-medium text-white shadow transition hover:bg-sky-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-600"
                            >
                                <span className="relative z-10">{loading ? "Signing in…" : "Sign in"}</span>
                                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition group-hover:translate-x-full" />
                            </button>

                            {/* Divider between email/password and Google sign-in */}
                            <div className="flex items-center gap-3">
                                <span className="h-px flex-1 bg-slate-200" />
                                <span className="text-xs uppercase tracking-wider text-slate-400">or</span>
                                <span className="h-px flex-1 bg-slate-200" />
                            </div>

                            {/* Google sign-in button */}
                            <button
                                type="button"
                                onClick={onGoogle}
                                disabled={loading}
                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-600 disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
                                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7C34.6 6.2 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-9 19.7-20 0-1.3-.1-2.2-.1-3.5z" />
                                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.2 19 14 24 14c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7C34.6 6.2 29.6 4 24 4 16.3 4 9.6 8.2 6.3 14.7z" />
                                    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.3l-6.2-5.1C29.3 36 26.8 37 24 37c-5.2 0-9.6-3.4-11.2-8.1l-6.6 5.1C9.5 39.8 16.2 44 24 44z" />
                                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-3.2 0-6.1-1.2-8.2-3.1l-6.6 5.1C12 42 17.7 44 24 44c11 0 19.7-9 19.7-20 0-1.3-.1-2.2-.1-3.5z" />
                                </svg>
                                Continue with Google
                            </button>

                            <p className="text-center text-sm text-slate-600">
                                Don&apos;t have an account?{" "}
                                <Link
                                    to={nextParam ? `/signup?next=${encodeURIComponent(nextParam)}` : "/signup"}
                                    className="font-medium text-sky-700 underline-offset-4 hover:underline"
                                >
                                    Sign up
                                </Link>

                            </p>
                        </form>
                    </div>

                    <p className="mt-4 text-center text-xs text-slate-400">
                        © {new Date().getFullYear()} Psy Web-App
                    </p>
                </div>
            </div>
        </div>
    );
}
