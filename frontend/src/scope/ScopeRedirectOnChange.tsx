// ScopeRedirectOnChange.tsx
// Purpose: whenever the scope (solo/org) or the selected org changes,
// force a redirect to "/" so route-bound components reload with the new scope.

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useScope } from "./ScopeContext";

export default function ScopeRedirectOnChange() {
  const { scope } = useScope();
  const navigate = useNavigate();

  // Keep previous signature to detect changes
  const prev = useRef<string>("");

  useEffect(() => {
    // Build a concise signature for comparison (mode + orgId)
    const sig = `${scope.mode}:${scope.orgId ?? ""}`;

    // Skip the very first render to avoid redirect loops on initial load
    if (prev.current && prev.current !== sig) {
      // NOTE: push to "/" so pages re-run their data hooks under the new scope
      navigate("/", { replace: true });
    }

    prev.current = sig;
  }, [scope.mode, scope.orgId, navigate]);

  return null;
}
