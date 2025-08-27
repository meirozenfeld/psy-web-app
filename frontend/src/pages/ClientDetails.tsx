import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { auth } from "../firebase";
import ProfileTab from "../components/clientDetails/ProfileTab";
import ContactTab from "../components/clientDetails/ContactTab";
import FilesTab from "../components/clientDetails/FilesTab";

// Optional: prepare more tab components later (SessionsTab, NotesTab, PaymentsTab, etc.)
// import SessionsTab from "@/components/clientDetails/SessionsTab";
// import NotesTab from "@/components/clientDetails/NotesTab";

export default function ClientDetails() {
    const { id } = useParams<{ id: string }>();
    const [search, setSearch] = useSearchParams();
    const navigate = useNavigate();
    const user = auth.currentUser;

    // Page-level UI state
    const [err, setErr] = useState<string | null>(null);
    const [title, setTitle] = useState<string>(""); // client full name for header

    // Determine the active tab from URL (?tab=profile|contact|sessions|notes...)
    const tab = (search.get("tab") || "profile").toLowerCase();

    // Helper to switch tabs (keeps deep-linkable URL)
    function setTab(next: string) {
        const q = new URLSearchParams(search);
        q.set("tab", next);
        setSearch(q, { replace: true });
    }

    // If no client id → return to list
    useEffect(() => {
        if (!id) navigate("/clients", { replace: true });
    }, [id, navigate]);

    if (!id) return null;

    return (
        <div className="max-w-5xl">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {title || "Client"}
                </h1>
                <p className="mt-1 text-sm text-slate-600">Client details</p>
                {err && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {err}
                    </div>
                )}
            </div>

            {/* Tabs bar */}
            <div className="mb-4 flex gap-2 border-b border-slate-200">
                {[
                    { key: "profile", label: "Profile" },
                    { key: "contact", label: "Contact" },
                    { key: "files", label: "Files" },    // ← הוספנו כאן
                    // { key: "sessions", label: "Sessions" },
                    // { key: "notes", label: "Notes" },
                ].map((t) => {
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={
                                "px-4 py-2 text-sm font-medium" +
                                (active
                                    ? " border-b-2 border-indigo-600 text-indigo-700"
                                    : " text-slate-600 hover:text-slate-800")
                            }
                            aria-current={active ? "page" : undefined}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div>
                {tab === "profile" && (
                    <ProfileTab
                        clientId={id}
                        onError={setErr}
                        onNameChange={setTitle}
                        onDeleted={() => navigate("/clients", { replace: true })}
                    />
                )}

                {tab === "contact" && (
                    <ContactTab
                        clientId={id}
                        onError={setErr}
                    />
                )}

                {tab === "files" && (
                    <FilesTab
                        clientId={id}
                        onError={setErr}
                    />
                )}
            </div>
        </div>
    );
}
