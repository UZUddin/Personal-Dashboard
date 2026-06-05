import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// ── Config from env ──────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
const GOOGLE_API_KEY   = process.env.REACT_APP_GOOGLE_API_KEY   || "";
const GOOGLE_SCOPES    = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.file";
const GOOGLE_DISCOVERY = [
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
];
const RING_CIRC = 2 * Math.PI * 32;
const LS = (k) => "dash_" + k;
const DAY_KEY          = LS("lastDayKey");
const CONSISTENCY_KEY  = LS("consistencyHistory");
const CAL_AUTH_KEY     = LS("calendarAuthed");
const CAL_HIDDEN_KEY   = LS("calendarHiddenEvents");
const SYNC_FILE_NAME   = "dashboard-state.json";
const SYNC_FILE_ID_KEY = LS("syncFileId");
const SYNC_TIME_KEY    = LS("lastSyncTime");
const DEFAULT_LOC      = { lat: 33.749, lon: -84.388, city: "Atlanta", country: "United States" };

// ── localStorage helpers ──────────────────────────────────────────────────────
const lsGet  = (k, fallback = null) => { try { const v = localStorage.getItem(k); return v !== null ? v : fallback; } catch { return fallback; } };
const lsSet  = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const lsJSON = (k, fallback = []) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

// ── Time helpers ──────────────────────────────────────────────────────────────
function fmt12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
function dayStr(d = new Date()) { return d.toISOString().slice(0, 10); }

// ── Weather ───────────────────────────────────────────────────────────────────
const WMO = {
  0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",
  45:"Foggy",48:"Icy fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",
  61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",
  80:"Showers",81:"Rain showers",82:"Heavy showers",95:"Thunderstorm",96:"Thunderstorm/hail"
};
function wmoKind(code) {
  const c = Number(code);
  if (c === 0 || c === 1) return "sunny";
  if (c === 2 || c === 3 || c === 45 || c === 48) return "cloudy";
  return "rain";
}
function buildOutfitSuggestion(low, high, detail) {
  const t = (detail || "").toLowerCase();
  const rain  = /rain|shower|storm|drizzle/.test(t);
  const wind  = /wind|breeze|gust/.test(t);
  const humid = /humid|muggy/.test(t);
  if (low == null) return "Set temps to get a wear recommendation.";
  const swing = Math.abs(high - low);
  let base;
  if      (swing >= 22) base = "Big temp swing — breathable base + removable layers.";
  else if (swing >= 12) base = "Morning chill, warmer later — light layers you can peel off.";
  else if (high <= 40)  base = "Cold all day — insulated coat, hat and gloves.";
  else if (high <= 55)  base = "Chilly — sweater plus a coat.";
  else if (high <= 70)  base = "Mild — long sleeve or light sweater.";
  else if (high <= 82)  base = "Comfortable — tee or breathable layers.";
  else                  base = "Hot — airy fabrics, shorts, hat, and water.";
  const extras = [];
  if (rain)  extras.push("pack a waterproof layer or umbrella.");
  if (wind)  extras.push("windy — grab a windbreaker.");
  if (humid && high >= 75) extras.push("go extra breathable for the humidity.");
  return extras.length ? `${base} ${extras.join(" ")}` : base;
}

function WeatherIcon({ kind }) {
  if (kind === "rain") return (
    <svg viewBox="0 0 64 64" className="weather-svg" aria-hidden="true">
      <path d="M24 40c-6 0-11-4-11-9s5-9 11-9c1.6 0 3.2.3 4.6.9C29.7 18.8 33.5 16 38 16c6.3 0 11.5 5.1 11.5 11.4 0 .2 0 .5-.1.7 3.4.9 6 4 6 7.9 0 4.4-3.6 8-8 8H24z" fill="rgba(233,221,175,0.22)" stroke="rgba(233,221,175,0.6)" strokeWidth="2" strokeLinejoin="round"/>
      <g stroke="#7b9c6b" strokeWidth="2.4" strokeLinecap="round">
        <line x1="24" y1="46" x2="21" y2="54"/><line x1="32" y1="46" x2="29" y2="54"/><line x1="40" y1="46" x2="37" y2="54"/>
      </g>
    </svg>
  );
  if (kind === "cloudy") return (
    <svg viewBox="0 0 64 64" className="weather-svg" aria-hidden="true">
      <path d="M24 42c-6 0-11-4-11-9s5-9 11-9c1.6 0 3.2.3 4.6.9C29.7 20.8 33.5 18 38 18c6.3 0 11.5 5.1 11.5 11.4 0 .2 0 .5-.1.7 3.4.9 6 4 6 7.9 0 4.4-3.6 8-8 8H24z" fill="rgba(233,221,175,0.22)" stroke="rgba(233,221,175,0.6)" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 64 64" className="weather-svg" aria-hidden="true">
      <circle cx="32" cy="32" r="12" fill="#e9ddaf" stroke="#c7ad6f" strokeWidth="2"/>
      <g stroke="#e9ddaf" strokeWidth="2.5" strokeLinecap="round">
        <line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/>
        <line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/>
        <line x1="14" y1="14" x2="20" y2="20"/><line x1="44" y1="44" x2="50" y2="50"/>
        <line x1="14" y1="50" x2="20" y2="44"/><line x1="44" y1="20" x2="50" y2="14"/>
      </g>
    </svg>
  );
}

// ── Checklist item ────────────────────────────────────────────────────────────
function CheckItem({ item, onToggle, onEdit, onDelete, hideCheckbox }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.textContent !== item.label) ref.current.textContent = item.label; }, [item.label]);
  return (
    <div className={`check-item${item.checked ? " completed" : ""}`}>
      {!hideCheckbox && (
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item.id)} />
      )}
      <span
        ref={ref}
        className="label"
        contentEditable
        suppressContentEditableWarning
        onBlur={e => onEdit(item.id, e.currentTarget.textContent || "")}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      />
      <button className="del-btn" onClick={() => onDelete(item.id)}>×</button>
    </div>
  );
}

function useChecklist(saveKey) {
  const [items, setItems] = useState(() => {
    const raw = lsJSON(LS(saveKey), []);
    return raw.map((r, i) => ({ ...r, id: r.id ?? i }));
  });
  const persist = useCallback((next) => { lsSet(LS(saveKey), JSON.stringify(next.map(({ id, ...r }) => r))); }, [saveKey]);
  const setAndSave = useCallback((fn) => setItems(prev => { const next = typeof fn === "function" ? fn(prev) : fn; persist(next); return next; }), [persist]);
  const toggle = useCallback((id) => setAndSave(p => p.map(i => i.id === id ? { ...i, checked: !i.checked } : i)), [setAndSave]);
  const edit   = useCallback((id, label) => setAndSave(p => p.map(i => i.id === id ? { ...i, label } : i)), [setAndSave]);
  const del    = useCallback((id) => setAndSave(p => p.filter(i => i.id !== id)), [setAndSave]);
  const add    = useCallback((label = "") => setAndSave(p => [...p, { id: Date.now(), label, checked: false }]), [setAndSave]);
  return { items, toggle, edit, del, add, setAndSave };
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ tasks, habits }) {
  const all = [...tasks, ...habits];
  const total = all.length;
  const checked = all.filter(i => i.checked).length;
  const progress = total ? checked / total : 0;
  const offset = RING_CIRC * (1 - progress);
  const complete = total > 0 && checked === total;
  return (
    <div className={`progress-wrapper${complete ? " complete" : ""}`}>
      <svg viewBox="0 0 80 80" className="ring">
        <circle className="ring-bg" cx="40" cy="40" r="32"/>
        <circle className="ring-progress" cx="40" cy="40" r="32"
          style={{ strokeDasharray: RING_CIRC, strokeDashoffset: offset }}/>
        <text x="40" y="43" className="ring-text">{total ? `${checked}/${total}` : "0/0"}</text>
      </svg>
      <div className="progress-check">✓</div>
    </div>
  );
}

// ── Consistency chart ──────────────────────────────────────────────────────────
function ConsistencyChart() {
  const history = lsJSON(CONSISTENCY_KEY, []).sort((a, b) => a.date.localeCompare(b.date));
  if (!history.length) return <div className="small-note">Once you start checking things off, your history will appear here.</div>;
  const W = 220, H = 120, PX = 24, PT = 12, PB = 28;
  const iW = W - PX * 2, iH = H - PT - PB;
  const n = history.length;
  const step = n ? iW / n : iW;
  const bw = Math.min(18, Math.max(8, step * 0.4));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, display: "block" }}>
      <line x1={PX} y1={PT + iH} x2={PX + iW} y2={PT + iH} stroke="rgba(255,255,255,0.25)" strokeWidth="0.5"/>
      {history.map((item, i) => {
        const v = Math.max(0, Math.min(1, item.value || 0));
        const h = item.habits != null ? Math.max(0, Math.min(1, item.habits)) : null;
        const bh = v * iH;
        const x = PX + i * step + (step - bw) / 2;
        const y = PT + (iH - bh);
        return (
          <g key={item.date}>
            <rect x={x} y={y} width={bw} height={bh} rx="2" fill="#bfa27a" opacity="0.9"/>
            {h && <rect x={x} y={PT + (iH - h * iH)} width={bw} height={h * iH} rx="2" fill="#8f7a5b" opacity="0.85"/>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Google Calendar hook ──────────────────────────────────────────────────────
function useGoogleCalendar() {
  const [status, setStatus]   = useState("idle"); // idle | loading | ready | error | no-config
  const [events, setEvents]   = useState([]);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState(() => lsGet(SYNC_TIME_KEY, ""));
  const gapiReady = useRef(false);
  const gisReady  = useRef(false);
  const tokenClient = useRef(null);

  const hasConfig = !!(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);

  const getHidden = () => new Set(lsJSON(CAL_HIDDEN_KEY, []));
  const addHidden = (key) => { const s = getHidden(); s.add(key); lsSet(CAL_HIDDEN_KEY, JSON.stringify([...s])); };
  const eventKey  = (ev) => ev ? `${ev.id || ev.summary}__${ev.start?.dateTime || ev.start?.date || ""}` : null;

  const formatTime = (ev) => {
    const s = ev.start?.dateTime || ev.start?.date;
    if (!s) return "TBD";
    if (ev.start?.date) return new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const d = new Date(s);
    return `${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  };

  const fetchEvents = useCallback(async () => {
    if (!window.gapi?.client?.calendar) return;
    setStatus("loading");
    try {
      const res = await window.gapi.client.calendar.events.list({
        calendarId: "primary", timeMin: new Date().toISOString(),
        showDeleted: false, singleEvents: true, maxResults: 5, orderBy: "startTime",
      });
      const hidden = getHidden();
      const visible = (res.result.items || []).filter(ev => !hidden.has(eventKey(ev)));
      setEvents(visible.map(ev => ({ id: eventKey(ev), title: ev.summary || "No title", time: formatTime(ev), checked: false, rawKey: eventKey(ev) })));
      setStatus("ready");
    } catch (err) {
      console.error("Calendar fetch failed", err);
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryInit = useCallback(() => {
    if (!gapiReady.current || !gisReady.current || !tokenClient.current) return;
    if (lsGet(CAL_AUTH_KEY) === "1") {
      tokenClient.current.requestAccessToken({ prompt: "" });
    }
  }, []);

  useEffect(() => {
    if (!hasConfig) { setStatus("no-config"); return; }
    const initGapi = () => {
      window.gapi.load("client", async () => {
        try {
          await window.gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: GOOGLE_DISCOVERY });
          gapiReady.current = true;
          tryInit();
        } catch (e) { console.error("gapi init failed", e); setStatus("error"); }
      });
    };
    const initGis = () => {
      tokenClient.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_SCOPES,
        callback: async (resp) => {
          if (resp.error) { setStatus("error"); return; }
          lsSet(CAL_AUTH_KEY, "1");
          await fetchEvents();
        },
      });
      gisReady.current = true;
      tryInit();
    };
    window.__gapiLoaded = initGapi;
    window.__gisLoaded  = initGis;
    if (window.gapi)   initGapi();
    if (window.google?.accounts) initGis();
  }, [hasConfig, tryInit, fetchEvents]);

  const connect  = () => { if (tokenClient.current) tokenClient.current.requestAccessToken({ prompt: "consent" }); };
  const signOut  = () => {
    const tok = window.gapi?.client?.getToken?.();
    if (tok?.access_token) window.google.accounts.oauth2.revoke(tok.access_token);
    window.gapi?.client?.setToken?.("");
    lsSet(CAL_AUTH_KEY, "0");
    setEvents([]); setStatus("idle");
  };
  const isAuthed = () => !!(window.gapi?.client?.getToken?.());

  // Drive sync
  const push = async () => {
    setSyncMsg("Pushing…");
    try {
      const payload = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), data: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith("dash_"))) });
      let fileId = lsGet(SYNC_FILE_ID_KEY);
      if (fileId) {
        try { await window.gapi.client.drive.files.update({ fileId, uploadType: "multipart", media: { mimeType: "application/json", body: payload } }); setSyncMsg("Pushed."); setLastSync(new Date().toISOString()); lsSet(SYNC_TIME_KEY, new Date().toISOString()); return; } catch { fileId = null; }
      }
      const res = await window.gapi.client.drive.files.create({ resource: { name: SYNC_FILE_NAME, appProperties: { app: "bedside-dash" }, parents: ["root"] }, uploadType: "multipart", media: { mimeType: "application/json", body: payload }, fields: "id" });
      if (res?.result?.id) { lsSet(SYNC_FILE_ID_KEY, res.result.id); setSyncMsg("Pushed (created new)."); setLastSync(new Date().toISOString()); lsSet(SYNC_TIME_KEY, new Date().toISOString()); }
      else setSyncMsg("Push failed.");
    } catch (e) { console.error(e); setSyncMsg("Push failed."); }
  };
  const pull = async () => {
    setSyncMsg("Pulling…");
    try {
      let fileId = lsGet(SYNC_FILE_ID_KEY);
      if (!fileId) {
        const res = await window.gapi.client.drive.files.list({ q: "appProperties has { key='app' and value='bedside-dash' } and trashed=false", orderBy: "modifiedTime desc", pageSize: 1, fields: "files(id)" });
        fileId = res?.result?.files?.[0]?.id;
      }
      if (!fileId) { setSyncMsg("No cloud copy found. Push first."); return; }
      const content = await window.gapi.client.drive.files.get({ fileId, alt: "media" });
      const state = content.result;
      if (state?.data) { Object.entries(state.data).forEach(([k, v]) => lsSet(k, v)); setSyncMsg("Pulled. Reloading…"); setLastSync(new Date().toISOString()); lsSet(SYNC_TIME_KEY, new Date().toISOString()); setTimeout(() => window.location.reload(), 400); }
    } catch (e) { console.error(e); setSyncMsg("Pull failed."); }
  };

  const dismissEvent = (key) => { addHidden(key); setEvents(p => p.filter(e => e.rawKey !== key)); };

  return { status, events, syncMsg, lastSync, connect, signOut, isAuthed, push, pull, dismissEvent };
}

// ── Prayer times hook ─────────────────────────────────────────────────────────
function usePrayerTimes() {
  const [times, setTimes] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${DEFAULT_LOC.city}&country=${encodeURIComponent(DEFAULT_LOC.country)}&method=2`;
    fetch(url).then(r => r.json()).then(data => {
      if (data?.code === 200 && data?.data?.timings) {
        const t = data.data.timings;
        const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
        const labels = { Fajr: "فجر", Dhuhr: "ظهر", Asr: "عصر", Maghrib: "مغرب", Isha: "عشاء" };
        setTimes(order.map(n => ({ name: n, arabic: labels[n], time: t[n] })));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);
  return { times, loading };
}

// ── Weather hook ──────────────────────────────────────────────────────────────
function useWeather() {
  const [weather, setWeather] = useState(null);
  const load = useCallback(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LOC.lat}&longitude=${DEFAULT_LOC.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
    fetch(url).then(r => r.json()).then(data => {
      const cw = data.current_weather;
      setWeather({
        temp: Math.round(cw.temperature),
        min:  Math.round(data.daily.temperature_2m_min[0]),
        max:  Math.round(data.daily.temperature_2m_max[0]),
        desc: WMO[cw.weathercode] || "Partly cloudy",
        kind: wmoKind(cw.weathercode),
      });
    }).catch(console.error);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15 * 60 * 1000); return () => clearInterval(t); }, [load]);
  return weather;
}

// ── Daily rollover ─────────────────────────────────────────────────────────────
function useDailyRollover(tasks, tomorrow, habits, setTasks, setTomorrow, setHabits) {
  useEffect(() => {
    const today = dayStr();
    if (!lsGet(DAY_KEY)) lsSet(DAY_KEY, today);
    const t = setInterval(() => {
      const now = dayStr();
      const stored = lsGet(DAY_KEY);
      if (now !== stored) {
        // log history
        const history = lsJSON(CONSISTENCY_KEY, []);
        const total = [...tasks.items, ...habits.items].length;
        const checked = [...tasks.items, ...habits.items].filter(i => i.checked).length;
        const habChecked = habits.items.filter(i => i.checked).length;
        const entry = { date: stored, value: total ? checked / total : 0, habits: habits.items.length ? habChecked / habits.items.length : 0 };
        const idx = history.findIndex(h => h.date === stored);
        if (idx >= 0) history[idx] = entry; else history.push(entry);
        lsSet(CONSISTENCY_KEY, JSON.stringify(history));
        // rollover
        const nextTasks = [
          ...tasks.items.filter(i => !i.checked && i.label.trim()).map(i => ({ label: i.label, checked: false })),
          ...tomorrow.items.filter(i => i.label.trim()).map(i => ({ label: i.label, checked: false })),
        ];
        setTasks(nextTasks.map((r, i) => ({ ...r, id: Date.now() + i })));
        lsSet(LS("dailyTasks"), JSON.stringify(nextTasks));
        setTomorrow([]);
        lsSet(LS("tomorrowTasks"), JSON.stringify([]));
        setHabits(p => { const reset = p.map(i => ({ ...i, checked: false })); lsSet(LS("dailyHabits"), JSON.stringify(reset.map(({ id, ...r }) => r))); return reset; });
        lsSet(DAY_KEY, now);
      }
    }, 60000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t); }, []);

  const tasks    = useChecklist("dailyTasks");
  const habits   = useChecklist("dailyHabits");
  const tomorrow = useChecklist("tomorrowTasks");

  useDailyRollover(tasks, tomorrow, habits, tasks.setAndSave, tomorrow.setAndSave, habits.setAndSave);

  const weather = useWeather();
  const prayer  = usePrayerTimes();
  const cal     = useGoogleCalendar();

  // Editable fields backed by localStorage
  const [notes,  setNotes]  = useState(() => lsGet(LS("notes"),  "Anything you want to remember for later tonight or tomorrow."));
  const [focus,  setFocus]  = useState(() => lsGet(LS("monthlyFocus"), "• Apply to jobs\n• Plants\n• Sewing"));

  // Seed sample consistency if none
  useEffect(() => {
    const h = lsJSON(CONSISTENCY_KEY, []);
    if (h.length) return;
    const today = new Date();
    const seeded = [0.7, 0.6, 0.8].map((v, i) => { const d = new Date(today); d.setDate(d.getDate() - (3 - i)); return { date: dayStr(d), value: v, habits: v * 0.8 }; });
    lsSet(CONSISTENCY_KEY, JSON.stringify(seeded));
  }, []);

  const h = now.getHours(), m = String(now.getMinutes()).padStart(2, "0");
  const timeStr = `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const suggestion = weather ? buildOutfitSuggestion(weather.min, weather.max, weather.desc) : "";

  // Next prayer highlight
  const nowMins = h * 60 + now.getMinutes();
  const nextPrayer = prayer.times ? prayer.times.findIndex(p => { const [ph, pm] = p.time.split(":").map(Number); return ph * 60 + pm > nowMins; }) : -1;

  return (
    <div className="app-shell">
      <div className="main-content">
        {/* HEADER */}
        <div className="header">
          <div className="header-left">
            <div className="date serif">{dateStr}</div>
            <div className="time serif">{timeStr}</div>
          </div>
          <div className="header-right">
            <ProgressRing tasks={tasks.items} habits={habits.items} />
          </div>
        </div>

        {/* COLUMNS */}
        <div className="columns">
          {/* ── COL 1: Weather + Tomorrow + Notes ── */}
          <div className="column">
            <div className="section">
              <div className="section-title serif">Today's Weather</div>
              <div className="weather-main">
                <div className="weather-icon">{weather && <WeatherIcon kind={weather.kind} />}</div>
                <div className="weather-temp-block">
                  <div className="weather-temp serif">{weather ? `${weather.temp}°F` : "—"}</div>
                  <div className="weather-range">
                    <span className="weather-low">{weather ? `Low ${weather.min}°F` : ""}</span>
                    <span className="range-sep">•</span>
                    <span className="weather-high">{weather ? `High ${weather.max}°F` : ""}</span>
                  </div>
                </div>
                <div className="weather-detail">{weather?.desc}</div>
                <div className="weather-reco small-note">{suggestion}</div>
              </div>
            </div>

            <div className="section">
              <div className="section-title serif">Tomorrow</div>
              <div className="section-subtitle">Add tasks for tomorrow's To-Do.</div>
              <div className="checklist">
                {tomorrow.items.map(item => (
                  <CheckItem key={item.id} item={item} onToggle={tomorrow.toggle} onEdit={tomorrow.edit} onDelete={tomorrow.del} hideCheckbox />
                ))}
              </div>
              <button className="add-btn" onClick={() => tomorrow.add()}>+ Add for tomorrow</button>
            </div>

            <div className="section">
              <div className="section-title serif">Notes</div>
              <div
                className="editable"
                style={{ minHeight: 80 }}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => { const v = e.currentTarget.textContent; setNotes(v); lsSet(LS("notes"), v); }}
                dangerouslySetInnerHTML={{ __html: notes }}
              />
            </div>
          </div>

          {/* ── COL 2: Habits + Tasks + Consistency ── */}
          <div className="column">
            <div className="section">
              <div className="section-title serif">Daily Habits</div>
              <div className="checklist">
                {habits.items.map(item => (
                  <CheckItem key={item.id} item={item} onToggle={habits.toggle} onEdit={habits.edit} onDelete={habits.del} />
                ))}
              </div>
              <button className="add-btn" onClick={() => habits.add()}>+ Add habit</button>
            </div>

            <div className="section">
              <div className="section-title serif">Daily To-Do</div>
              <div className="checklist">
                {tasks.items.map(item => (
                  <CheckItem key={item.id} item={item} onToggle={tasks.toggle} onEdit={tasks.edit} onDelete={tasks.del} />
                ))}
              </div>
              <button className="add-btn" onClick={() => tasks.add()}>+ Add task</button>
            </div>

            <div className="section">
              <div className="section-title serif">Consistency Monitor</div>
              <div className="section-subtitle">Tasks + habits over time.</div>
              <ConsistencyChart />
            </div>
          </div>

          {/* ── COL 3: Calendar + Focus + Prayer ── */}
          <div className="column">
            <div className="section">
              <div className="section-header">
                <div className="section-title serif">Google Calendar</div>
                <div className="calendar-actions compact">
                  {cal.status !== "no-config" && (
                    <>
                      <button className="pill-btn" onClick={cal.isAuthed() ? () => {} : cal.connect}>
                        {cal.isAuthed() ? "Refresh" : "Connect"}
                      </button>
                      {cal.isAuthed() && <button className="pill-btn ghost" onClick={cal.signOut}>Sign out</button>}
                    </>
                  )}
                </div>
              </div>
              {cal.status === "no-config" && (
                <div className="small-note">Add <code>REACT_APP_GOOGLE_CLIENT_ID</code> and <code>REACT_APP_GOOGLE_API_KEY</code> to your Render environment to enable Calendar.</div>
              )}
              {cal.status === "loading" && <div className="small-note">Loading events…</div>}
              {cal.status === "error"   && <div className="small-note">Couldn't load events. Check your Google credentials.</div>}
              <div className="calendar-list checklist">
                {cal.events.map(ev => (
                  <div key={ev.id} className="check-item">
                    <input type="checkbox" onChange={() => cal.dismissEvent(ev.rawKey)} />
                    <div className="calendar-event-body">
                      <span className="label">{ev.title}</span>
                    </div>
                    <span className="calendar-event-time">{ev.time}</span>
                  </div>
                ))}
              </div>
              {cal.syncMsg && <div className="small-note">{cal.syncMsg}</div>}
            </div>

            <div className="section">
              <div className="section-title serif">Monthly Focus</div>
              <div
                className="editable stealth-edit"
                style={{ minHeight: 70 }}
                contentEditable
                suppressContentEditableWarning
                onBlur={e => { const v = e.currentTarget.textContent; setFocus(v); lsSet(LS("monthlyFocus"), v); }}
                dangerouslySetInnerHTML={{ __html: focus }}
              />
            </div>

            <div className="section">
              <div className="section-title serif">Prayer Times</div>
              <div className="section-subtitle">Today • {DEFAULT_LOC.city}</div>
              {prayer.loading && <div className="small-note">Loading…</div>}
              <div className="prayer-list">
                {prayer.times?.map((p, i) => (
                  <div key={p.name} className={`prayer-row${i === nextPrayer ? " next-prayer" : ""}`}>
                    <span className="prayer-time">{fmt12(p.time)}</span>
                    <span className="prayer-name">{p.arabic}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="footer">
        Last sync: {cal.lastSync ? new Date(cal.lastSync).toLocaleString() : "Not yet synced"}
      </div>

      {/* SYNC DOCK */}
      {cal.isAuthed() && (
        <div className="sync-dock">
          <button className="pill-btn ghost sync-fab" onClick={cal.pull}>Pull</button>
          <button className="pill-btn ghost sync-fab" onClick={cal.push}>Push</button>
        </div>
      )}

      {/* Google scripts — loaded after app to avoid blocking */}
      {GOOGLE_CLIENT_ID && (
        <>
          <script async defer src="https://apis.google.com/js/api.js" onLoad={() => window.__gapiLoaded?.()} />
          <script async defer src="https://accounts.google.com/gsi/client" onLoad={() => window.__gisLoaded?.()} />
        </>
      )}
    </div>
  );
}
