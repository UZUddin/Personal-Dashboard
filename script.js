// ---------- CONSTANTS ----------
const RING_RADIUS = 32;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const DAY_KEY = "dash_lastDayKey";
const CONSISTENCY_KEY = "dash_consistencyHistory";

// --- PRAYER TIME CONFIG ---
const PRAYER_API_CONFIG = {
  city: "Atlanta",          // change as needed
  country: "United States", // change as needed
  method: 2,                // ISNA; can change to other methods
};

// ---------- TIME & DATE ----------
function updateTime() {
  const now = new Date();
  const timeEl = document.getElementById("time");
  const dateEl = document.getElementById("date");

  if (!timeEl || !dateEl) return;

  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const displayHours = hours % 12 || 12;
  const ampm = hours < 12 ? "am" : "pm";

  timeEl.textContent = `${displayHours}:${minutes} ${ampm}`;

  const options = { weekday: "long", month: "long", day: "numeric" };
  dateEl.textContent = now.toLocaleDateString(undefined, options);
}

function getDayString(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---------- EDITABLE FIELDS ----------
function loadEditableFields() {
  document.querySelectorAll(".editable[data-save]").forEach((el) => {
    const key = "dash_" + el.dataset.save;
    const saved = localStorage.getItem(key);
    if (saved !== null && saved !== undefined) {
      el.textContent = saved;
      el.classList.remove("placeholder");
    }
  });
}

function attachEditableSaveListeners() {
  document.querySelectorAll(".editable[data-save]").forEach((el) => {
    const key = "dash_" + el.dataset.save;
    el.addEventListener("input", () => {
      localStorage.setItem(key, el.textContent);
      el.classList.remove("placeholder");
    });
  });
}

// ---------- CHECKLIST HELPERS ----------
function applyChecklistStyles() {
  document.querySelectorAll(".check-item").forEach((item) => {
    const cb = item.querySelector('input[type="checkbox"]');
    if (!cb) return;
    item.classList.toggle("completed", cb.checked);
  });
}

function computeOverallCompletionRatio() {
  const boxes = document.querySelectorAll(
    '.checklist[data-save="dailyTasks"] input[type="checkbox"], ' +
    '.checklist[data-save="dailyHabits"] input[type="checkbox"]'
  );
  const total = boxes.length;
  let checked = 0;
  boxes.forEach((cb) => {
    if (cb.checked) checked++;
  });
  return total ? checked / total : 0;
}

function updateProgressRing() {
  const progress = computeOverallCompletionRatio();
  const offset = RING_CIRC * (1 - progress);

  const ring = document.querySelector(".ring-progress");
  const text = document.querySelector(".ring-text");
  const boxes = document.querySelectorAll(
    '.checklist[data-save="dailyTasks"] input[type="checkbox"], ' +
    '.checklist[data-save="dailyHabits"] input[type="checkbox"]'
  );
  const total = boxes.length;
  let checked = 0;
  boxes.forEach((cb) => {
    if (cb.checked) checked++;
  });

  if (ring) {
    ring.style.strokeDasharray = String(RING_CIRC);
    ring.style.strokeDashoffset = String(offset);
  }
  if (text) {
    text.textContent = total ? `${checked}/${total}` : "0/0";
  }
}

function saveChecklist(listEl) {
  const key = "dash_" + listEl.dataset.save;
  const items = [];
  listEl.querySelectorAll(".check-item").forEach((item) => {
    const cb = item.querySelector('input[type="checkbox"]');
    const label = item.querySelector(".label");
    if (!label) return;
    const text = (label.textContent || "").trim();
    if (text === "") {
      return; // skip empty rows
    }
    items.push({
      label: text,
      checked: cb && cb.checked,
    });
  });
  localStorage.setItem(key, JSON.stringify(items));
  applyChecklistStyles();
  updateProgressRing();
}

function loadChecklists() {
  document.querySelectorAll(".checklist[data-save]").forEach((listEl) => {
    const key = "dash_" + listEl.dataset.save;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const items = JSON.parse(saved);
        if (Array.isArray(items)) {
          listEl.innerHTML = "";
          items.forEach((item) => {
            const wrap = document.createElement("div");
            wrap.className = "check-item";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!item.checked;

            const label = document.createElement("span");
            label.className = "label";
            label.contentEditable = "true";
            label.textContent = item.label || "";

            wrap.appendChild(cb);
            wrap.appendChild(label);
            listEl.appendChild(wrap);
          });
        }
      } catch (e) {
        console.error("Failed to load checklist", key, e);
      }
    }
  });

  applyChecklistStyles();
  updateProgressRing();
}

function attachChecklistListeners() {
  document.querySelectorAll(".checklist[data-save]").forEach((listEl) => {
    listEl.addEventListener("change", (e) => {
      if (e.target.matches('input[type="checkbox"]')) {
        saveChecklist(listEl);
      }
    });
    listEl.addEventListener("input", (e) => {
      if (e.target.classList.contains("label")) {
        const label = e.target;
        const parent = label.closest(".check-item");
        if (label.textContent.trim() === "") {
          parent.remove();
        }
        saveChecklist(listEl);
      }
    });
  });
}

function attachAddButtons() {
  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      const listEl = document.querySelector(
        `.checklist[data-save="${target}"]`
      );
      if (!listEl) return;

      const wrap = document.createElement("div");
      wrap.className = "check-item";

      const cb = document.createElement("input");
      cb.type = "checkbox";

      const label = document.createElement("span");
      label.className = "label";
      label.contentEditable = "true";
      label.textContent = "";

      wrap.appendChild(cb);
      wrap.appendChild(label);
      listEl.appendChild(wrap);

      label.focus();
      saveChecklist(listEl);
    });
  });
}

function resetDailyTasks() {
  const listEl = document.querySelector('.checklist[data-save="dailyTasks"]');
  if (!listEl) return;
  listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = false;
  });
  saveChecklist(listEl);
}

// ---------- CONSISTENCY HISTORY & CHART ----------
function getConsistencyHistory() {
  const raw = localStorage.getItem(CONSISTENCY_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch (e) {
    console.error("Bad consistency history", e);
  }
  return [];
}

function saveConsistencyHistory(history) {
  localStorage.setItem(CONSISTENCY_KEY, JSON.stringify(history));
}

function logDayCompletion(dateStr, value) {
  const history = getConsistencyHistory();
  const idx = history.findIndex((h) => h.date === dateStr);
  const val = Math.max(0, Math.min(1, value || 0));
  if (idx >= 0) {
    history[idx].value = val;
  } else {
    history.push({ date: dateStr, value: val });
  }
  saveConsistencyHistory(history);
  renderConsistencyChart();
}

function renderConsistencyChart() {
  const container = document.getElementById("consistencyChart");
  const emptyMsg = document.getElementById("consistencyEmpty");
  if (!container) return;

  const history = getConsistencyHistory();
  if (!history.length) {
    container.innerHTML = "";
    if (emptyMsg) emptyMsg.style.display = "block";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";

  const width = 200;
  const height = 80;
  const paddingX = 12;
  const paddingTop = 15;
  const paddingBottom = 18;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const n = history.length;
  const step = n > 1 ? innerWidth / (n - 1) : 0;

  let points = "";
  let circles = "";

  history.forEach((item, i) => {
    const x = paddingX + (n > 1 ? i * step : innerWidth / 2);
    const v = Math.max(0, Math.min(1, item.value || 0));
    const y = paddingTop + (1 - v) * innerHeight;
    points += `${x},${y} `;
    circles += `<circle cx="${x}" cy="${y}" r="2" fill="#bfa27a"/>`;
  });

  const baseline = `<line x1="${paddingX}" y1="${paddingTop +
    innerHeight}" x2="${paddingX +
    innerWidth}" y2="${paddingTop +
    innerHeight}" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>`;

  const polyline = `<polyline points="${points.trim()}" fill="none" stroke="#bfa27a" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}">${baseline}${polyline}${circles}</svg>`;
}

// ---------- PRAYER TIMES ----------
function fetchPrayerTimes() {
  const cfg = PRAYER_API_CONFIG;
  const labelEl = document.getElementById("prayerLocationLabel");
  const listEl = document.getElementById("prayerTimes");

  if (!listEl) return;

  if (labelEl) {
    labelEl.textContent = `Today • ${cfg.city}`;
  }

  listEl.textContent = "Loading prayer times…";

  const url =
    "https://api.aladhan.com/v1/timingsByCity" +
    `?city=${encodeURIComponent(cfg.city)}` +
    `&country=${encodeURIComponent(cfg.country)}` +
    `&method=${encodeURIComponent(cfg.method)}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (!data || data.code !== 200 || !data.data || !data.data.timings) {
        throw new Error("Bad response");
      }
      const t = data.data.timings;
      const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

      listEl.innerHTML = "";
      order.forEach((name) => {
        const timeVal = t[name];
        if (!timeVal) return;

        const row = document.createElement("div");
        row.className = "prayer-row";

        const label = document.createElement("span");
        label.className = "prayer-name";
        label.textContent = name;

        const time = document.createElement("span");
        time.className = "prayer-time";
        time.textContent = timeVal;

        row.appendChild(label);
        row.appendChild(time);
        listEl.appendChild(row);
      });
    })
    .catch((err) => {
      console.error("Prayer time fetch error:", err);
      listEl.textContent =
        "Couldn’t load prayer times. Check your connection or city setting.";
    });
}

// ---------- MIDNIGHT ROLLOVER ----------
function initDailyRollover() {
  const today = getDayString();
  let lastDay = localStorage.getItem(DAY_KEY);
  if (!lastDay) {
    localStorage.setItem(DAY_KEY, today);
    lastDay = today;
  }

  // Check once a minute whether date changed
  setInterval(() => {
    const now = new Date();
    const current = getDayString(now);
    const stored = localStorage.getItem(DAY_KEY) || current;

    if (current !== stored) {
      // We're crossing into a new day.
      const completion = computeOverallCompletionRatio();
      logDayCompletion(stored, completion);

      // Reset Daily Tasks only.
      resetDailyTasks();

      // Update lastDay key.
      localStorage.setItem(DAY_KEY, current);
    }
  }, 60000);
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  updateTime();
  setInterval(updateTime, 10000);

  loadEditableFields();
  attachEditableSaveListeners();

  loadChecklists();
  attachChecklistListeners();
  attachAddButtons();

  renderConsistencyChart();
  initDailyRollover();

  fetchPrayerTimes();
});
