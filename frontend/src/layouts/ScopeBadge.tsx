// src/layouts/ScopeBadge.tsx
import { useScope } from "../scope/ScopeContext";

export default function ScopeBadge() {
    const { scope } = useScope();
    return (
        <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
            {scope.mode === "solo" ? "Scope: Solo" : `Scope: ${scope.orgName || "Clinic"}`}
        </span>
    );
}
