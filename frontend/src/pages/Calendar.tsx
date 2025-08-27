// Therapist Calendar: month grid with realtime sessions, month navigation,
// and a modal to create new sessions.
// Data model: users/{uid}/sessions with fields:
//   - clientId?: string
//   - clientName?: string
//   - startAt: Timestamp
//   - endAt?: Timestamp
//   - location?: string
//   - createdAt, updatedAt: Timestamp
//
// Notes:
// - Realtime subscription scoped to the visible range using a range query on startAt.
// - Minimal dependency footprint: plain React + Tailwind + Firestore SDK.
// - All date math is kept here (no external date library).

import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  doc,          // needed for update/delete specific session
  updateDoc,    // update handler
  deleteDoc,
  onSnapshot as onSnapDoc,   // delete handler
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import CreateSessionModal from "../components/calendar/CreateSessionModal";
import type { CreateSessionForm } from "../components/calendar/CreateSessionModal";

// ---- Types ----
type Session = {
  id?: string;
  clientId?: string | null; // allow null explicitly
  clientName?: string;
  startAt: any; // Firestore Timestamp
  endAt?: any;  // Firestore Timestamp
  location?: string;
  createdAt?: any;
  updatedAt?: any;
};

type Client = {
  id: string;              // Firestore doc id
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status?: "active" | "paused" | "archived";
};

type ViewMode = "day" | "week" | "month";

// ---- Date helpers (no external libs) ----
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 0) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  const delta = weekStartsOn === 1 ? (day === 0 ? 6 : day - 1) : day;
  return addDays(x, -delta);
}
function endOfWeek(d: Date, weekStartsOn: 0 | 1 = 0) {
  const s = startOfWeek(d, weekStartsOn);
  return endOfDay(addDays(s, 6));
}
function startOfMonth(d: Date) {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth(d: Date) {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}
function getWeekStart(d: Date, weekStartsOn: 0 | 1 = 0) {
  const day = d.getDay(); // 0=Sun..6=Sat
  return weekStartsOn === 1 ? (day === 0 ? 6 : day - 1) : day;
}
function gridStart(d: Date, weekStartsOn: 0 | 1 = 0) {
  const first = startOfMonth(d);
  const delta = getWeekStart(first, weekStartsOn);
  const s = new Date(first);
  s.setDate(first.getDate() - delta);
  s.setHours(0, 0, 0, 0);
  return s;
}
function buildMonthGrid(d: Date, weekStartsOn: 0 | 1 = 0) {
  const start = gridStart(d, weekStartsOn);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    days.push(x);
  }
  return days;
}
function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function toDateTimeInputs(ts?: any) {
  if (!ts?.toMillis && !(ts instanceof Date)) return { date: "", time: "" };
  const dt: Date = ts.toMillis ? new Date(ts.toMillis()) : (ts as Date);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const HH = String(dt.getHours()).padStart(2, "0");
  const MM = String(dt.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}` };
}
function fromDateTimeInputs(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = timeStr.split(":").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// ---- Page ----
export default function Calendar() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Anchor date for visible range
  const [cursor, setCursor] = useState<Date>(startOfDay(new Date()));
  const [view, setView] = useState<ViewMode>("month");

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Month/year picker state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement | null>(null);

  // Create Session modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateSessionForm>({
    clientId: "",
    clientName: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
  });

  const [userTz, setUserTz] = useState<string | null>(null);

  // Clients for autocomplete (passed to CreateSessionModal)
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsErr, setClientsErr] = useState<string | null>(null);

  // Close month picker on outside click or Esc
  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      if (!monthPickerRef.current) return;
      if (!monthPickerRef.current.contains(ev.target as Node)) {
        setShowMonthPicker(false);
      }
    }
    function onDocKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setShowMonthPicker(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapDoc(ref, (snap) => {
      const data = snap.data() as any;
      const v = (data?.prefs?.defaultView as ViewMode) || null;
      const tz = (data?.prefs?.timeZone as string) || null;
      if (v) setView(v);              // set default view once loaded
      if (tz) setUserTz(tz);          // store time zone for rendering
    });
    return () => unsub();
  }, [user?.uid]);

  // Realtime clients list
  useEffect(() => {
    if (!user) {
      setClients([]);
      setClientsErr(null);
      return;
    }
    const ref = collection(db, "users", user.uid, "clients");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const rows: Client[] = [];
        snap.forEach((d) => {
          const c = d.data() as any;
          rows.push({
            id: d.id,
            firstName: c.firstName || "",
            lastName: c.lastName || "",
            email: c.email || "",
            phone: c.phone || "",
            status: c.status || "active",
          });
        });
        rows.sort((a, b) =>
          `${a.firstName} ${a.lastName}`.trim().toLowerCase()
            .localeCompare(`${b.firstName} ${b.lastName}`.trim().toLowerCase())
        );
        setClients(rows);
        setClientsErr(null);
      },
      (err) => {
        console.error("Clients subscription error:", err);
        setClients([]);
        setClientsErr(err?.message || "Failed to load clients");
      }
    );
    return () => unsub();
  }, [user?.uid]);

  // Visible range (day/week/month) for Firestore subscription
  const visibleRange = useMemo(() => {
    if (view === "day") {
      return { start: startOfDay(cursor), end: endOfDay(cursor) };
    }
    if (view === "week") {
      return { start: startOfWeek(cursor, 0), end: endOfWeek(cursor, 0) };
    }
    const s = startOfMonth(cursor);
    const e = endOfMonth(cursor);
    return { start: new Date(s.getTime() - 1), end: new Date(e.getTime() + 1) };
  }, [cursor, view]);

  // Subscribe to sessions within the visible range
  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const ref = collection(db, "users", user.uid, "sessions");
    const qref = query(
      ref,
      where("startAt", ">=", visibleRange.start),
      where("startAt", "<=", visibleRange.end),
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(
      qref,
      (snap) => {
        const list: Session[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Session) }));
        setSessions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Calendar sessions error:", err);
        setError(err?.message || "Failed to load sessions");
        setSessions([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid, visibleRange.start, visibleRange.end]);

  // Group by day (for all views)
  const byDay = useMemo(() => {
    const map: Record<string, Session[]> = {};
    sessions.forEach((s) => {
      const ms = s.startAt?.toMillis?.() as number | undefined;
      if (!ms) return;
      const d = new Date(ms);
      const k = dayKey(d);
      (map[k] ||= []).push(s);
    });
    return map;
  }, [sessions]);

  // Cells for month view
  const monthCells = useMemo(() => buildMonthGrid(cursor, 0), [cursor]);

  // Days for week view
  const weekDays = useMemo(() => {
    const s = startOfWeek(cursor, 0);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [cursor]);

  // Open "create session" modal with prefilled date
  function openCreateFor(day?: Date) {
    const d = day ? startOfDay(day) : startOfDay(new Date());
    setPrefillDate(d);
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    setForm({
      clientId: "",
      clientName: "",
      date: `${yyyy}-${mm}-${dd}`,
      startTime: "09:00",
      endTime: "10:00",
      location: "",
    });
    setOpenAdd(true);
  }

  // Create session
  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.clientName.trim() || !form.date || !form.startTime) return;

    const [y, m, d] = form.date.split("-").map((n) => parseInt(n, 10));
    const [sh, sm] = form.startTime.split(":").map((n) => parseInt(n, 10));
    const start = new Date(y, m - 1, d, sh, sm, 0, 0);

    let end: Date | null = null;
    if (form.endTime) {
      const [eh, em] = form.endTime.split(":").map((n) => parseInt(n, 10));
      end = new Date(y, m - 1, d, eh, em, 0, 0);
      if (end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + 30 * 60 * 1000);
      }
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "sessions"), {
        ...(form.clientId ? { clientId: form.clientId } : {}),
        clientName: form.clientName.trim(),
        startAt: start,
        endAt: end || null,
        location: form.location.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as Omit<Session, "id">);

      setOpenAdd(false);
    } catch (err: any) {
      alert(err?.message || "Failed to create session");
    } finally {
      setSaving(false);
    }
  }

  // Edit modal state
  const [selected, setSelected] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState({
    clientName: "",
    date: "",       // yyyy-mm-dd
    startTime: "",  // HH:MM
    endTime: "",    // HH:MM
    location: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Update session
  async function onUpdateSelected(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selected?.id) return;
    if (!editForm.clientName.trim() || !editForm.date || !editForm.startTime) return;

    const start = fromDateTimeInputs(editForm.date, editForm.startTime);
    let end: Date | null = null;
    if (editForm.endTime) {
      const eDt = fromDateTimeInputs(editForm.date, editForm.endTime);
      end = eDt.getTime() > start.getTime() ? eDt : new Date(start.getTime() + 30 * 60 * 1000);
    }

    setSavingEdit(true);
    try {
      const ref = doc(db, "users", user.uid, "sessions", selected.id!);
      await updateDoc(ref, {
        clientName: editForm.clientName.trim(),
        startAt: start,
        endAt: end || null,
        location: editForm.location.trim(),
        updatedAt: serverTimestamp(),
      });
      setSelected(null);
    } catch (err: any) {
      alert(err?.message || "Failed to update session");
    } finally {
      setSavingEdit(false);
    }
  }

  // Delete session
  async function onDeleteSelected() {
    if (!user || !selected?.id) return;
    if (!confirm("Delete this session? This action cannot be undone.")) return;

    setSavingEdit(true);
    try {
      const ref = doc(db, "users", user.uid, "sessions", selected.id!);
      await deleteDoc(ref);
      setSelected(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete session");
    } finally {
      setSavingEdit(false);
    }
  }

  // Header helpers
  function stepCursor(dir: -1 | 1) {
    if (view === "day") setCursor(addDays(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, 7 * dir));
    else setCursor(addMonths(cursor, dir));
  }
  const todayKey = dayKey(new Date());

  return (
    <div className="max-w-6xl">
      {/* Header with navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your sessions. Click a day to add a session.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1 text-sm">
            {(["day", "week", "month"] as ViewMode[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg px-2 py-1 capitalize ${view === v ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
                title={`View: ${v}`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Prev / Label (month-year picker) / Next / Today */}
          <button
            type="button"
            onClick={() => stepCursor(-1)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            aria-label="Previous"
            title="Previous"
          >
            ‹
          </button>

          <div className="relative" ref={monthPickerRef}>
            <button
              type="button"
              onClick={() => setShowMonthPicker((v) => !v)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              aria-haspopup="dialog"
              aria-expanded={showMonthPicker}
              title="Pick month & year"
            >
              {view === "month"
                ? cursor.toLocaleString(undefined, { month: "long", year: "numeric" })
                : view === "week"
                  ? `Week of ${startOfWeek(cursor).toLocaleDateString()}`
                  : cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </button>

            {showMonthPicker && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg z-20 p-3">
                {/* Year selector */}
                <select
                  value={cursor.getFullYear()}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value, 10);
                    setCursor(new Date(newYear, cursor.getMonth(), 1));
                  }}
                  className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                >
                  {Array.from({ length: 11 }).map((_, i) => {
                    const base = new Date().getFullYear();
                    const year = base - 5 + i; // 5 back .. 5 forward
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>

                {/* Month selector */}
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setCursor(new Date(cursor.getFullYear(), i, 1));
                        setShowMonthPicker(false);
                      }}
                      className={`rounded-md px-2 py-1 text-sm ${cursor.getMonth() === i
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-slate-100"
                        }`}
                    >
                      {new Date(0, i).toLocaleString(undefined, { month: "short" })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => stepCursor(1)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            aria-label="Next"
            title="Next"
          >
            ›
          </button>

          <button
            type="button"
            onClick={() => setCursor(startOfDay(new Date()))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            Today
          </button>

          {/* Quick add (opens modal with today's date) */}
          <button
            type="button"
            onClick={() => openCreateFor(new Date())}
            className="ml-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add session
          </button>
        </div>
      </div>

      {/* Loading / Error notice */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Loading sessions…
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Month view */}
      {view === "month" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-600">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* 6x7 cells */}
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {monthCells.map((d) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = k === todayKey;
              const daySessions = byDay[k] || [];

              return (
                <div
                  key={k}
                  className={`min-h-[110px] bg-white p-2 ${!inMonth ? "bg-slate-50/70 text-slate-400" : ""}`}
                >
                  {/* Day header (click to open modal) */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => openCreateFor(d)}
                      className={`h-7 w-7 rounded-full text-xs font-semibold ${isToday ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      title="Add session"
                      aria-label="Add session"
                    >
                      {d.getDate()}
                    </button>
                    {daySessions.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {daySessions.length}
                      </span>
                    )}
                  </div>

                  {/* Sessions list (truncate to 3 for compact cell) */}
                  <div className="mt-1 space-y-1">
                    {daySessions.slice(0, 3).map((s) => {
                      const ms = s.startAt?.toMillis?.();
                      const time = ms
                        ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const start = toDateTimeInputs(s.startAt);
                            const end = toDateTimeInputs(s.endAt);
                            setEditForm({
                              clientName: s.clientName || "",
                              date: start.date || "",
                              startTime: start.time || "09:00",
                              endTime: end.time || "",
                              location: s.location || "",
                            });
                            setSelected(s);
                          }}
                          className="w-full truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                          title={`${s.clientName || "Session"} @ ${time}${s.location ? ` • ${s.location}` : ""}`}
                        >
                          {time} — {s.clientName || "Session"}
                        </button>
                      );
                    })}
                    {daySessions.length > 3 && (
                      <div className="text-[11px] text-slate-500">+{daySessions.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === "week" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {/* Weekday header with dates */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-600">
            {weekDays.map((d) => (
              <div key={dayKey(d)} className="px-2 py-2">
                {d.toLocaleString(undefined, { weekday: "short" })}
                <div className="text-[11px] font-normal text-slate-500">
                  {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {weekDays.map((d) => {
              const k = dayKey(d);
              const isToday = k === todayKey;
              const daySessions = (byDay[k] || []).slice().sort((a, b) =>
                (a.startAt?.toMillis?.() || 0) - (b.startAt?.toMillis?.() || 0)
              );
              return (
                <div key={k} className="min-h-[160px] bg-white p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => openCreateFor(d)}
                      className={`h-7 w-7 rounded-full text-xs font-semibold ${isToday ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                      title="Add session"
                    >
                      {d.getDate()}
                    </button>
                    {!!daySessions.length && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {daySessions.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {daySessions.map((s) => {
                      const ms = s.startAt?.toMillis?.();
                      const time = ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const start = toDateTimeInputs(s.startAt);
                            const end = toDateTimeInputs(s.endAt);
                            setEditForm({
                              clientName: s.clientName || "",
                              date: start.date || "",
                              startTime: start.time || "09:00",
                              endTime: end.time || "",
                              location: s.location || "",
                            });
                            setSelected(s);
                          }}
                          className="w-full truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                        >
                          {time} — {s.clientName || "Session"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day view */}
      {view === "day" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            {cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div className="p-3">
            {(() => {
              const k = dayKey(cursor);
              const daySessions = (byDay[k] || []).slice().sort((a, b) =>
                (a.startAt?.toMillis?.() || 0) - (b.startAt?.toMillis?.() || 0)
              );
              if (daySessions.length === 0) {
                return (
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 p-4">
                    <span className="text-sm text-slate-500">No sessions for this day</span>
                    <button
                      type="button"
                      onClick={() => openCreateFor(cursor)}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Add session
                    </button>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  {daySessions.map((s) => {
                    const ms = s.startAt?.toMillis?.();
                    const time = ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm text-slate-800">
                          <div className="font-medium">{s.clientName || "Session"}</div>
                          <div className="text-slate-500">
                            {time}{s.location ? ` • ${s.location}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const start = toDateTimeInputs(s.startAt);
                              const end = toDateTimeInputs(s.endAt);
                              setEditForm({
                                clientName: s.clientName || "",
                                date: start.date || "",
                                startTime: start.time || "09:00",
                                endTime: end.time || "",
                                location: s.location || "",
                              });
                              setSelected(s);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Create Session Modal (extracted component) */}
      <CreateSessionModal
        open={openAdd}
        saving={saving}
        form={form}
        setForm={setForm}
        onSubmit={onCreate}
        onClose={() => setOpenAdd(false)}
        clients={clients}
        clientsError={clientsErr}
      />

      {/* Edit Session Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => !savingEdit && setSelected(null)}
          />
          {/* Dialog */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit session</h3>
              <button
                type="button"
                onClick={() => !savingEdit && setSelected(null)}
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <form className="grid gap-4" onSubmit={onUpdateSelected}>
              {/* Client name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Client name <span className="text-rose-500">*</span>
                </label>
                <input
                  value={editForm.clientName}
                  onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${!editForm.clientName.trim()
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : "border-slate-300 focus:border-indigo-400 focus:ring-indigo-100"
                    }`}
                  placeholder="e.g., Dana Levi"
                  required
                />
              </div>

              {/* Date + times */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
                  <input
                    type="time"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
                  <input
                    type="time"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* Location (optional) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                <input
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Clinic A / Zoom / Home visit"
                />
              </div>

              {/* Actions */}
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={
                    savingEdit ||
                    !editForm.clientName.trim() ||
                    !editForm.date ||
                    !editForm.startTime
                  }
                  className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" className="opacity-25" />
                        <path d="M4 12a8 8 0 0 1 8-8" className="opacity-75" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>Save changes</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onDeleteSelected}
                  disabled={savingEdit}
                  className="inline-flex items-center rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                  title="Delete session"
                >
                  Delete
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  disabled={savingEdit}
                  className="ml-auto inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
