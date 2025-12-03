// ---------- CONSTANTS ----------
const RING_RADIUS = 32;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const DAY_KEY = "dash_lastDayKey";
const CONSISTENCY_KEY = "dash_consistencyHistory";
const WEATHER_ICON_KIND = {
  SUNNY: "sunny",
  CLOUDY: "cloudy",
  RAIN: "rain",
};
const DEFAULT_LOCATION = {
  lat: 33.749,
  lon: -84.388,
  label: "Atlanta",
};

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
  const wrapper = document.querySelector(".progress-wrapper");
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
  if (wrapper) {
    if (total > 0 && checked === total) {
      wrapper.classList.add("complete");
    } else {
      wrapper.classList.remove("complete");
    }
  }
}

function saveChecklist(listEl) {
  pruneEmptyItems(listEl);
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
    pruneEmptyItems(listEl);
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
        pruneEmptyItems(listEl);
        saveChecklist(listEl);
      }
    });
    listEl.addEventListener("blur", () => {
      pruneEmptyItems(listEl);
      saveChecklist(listEl);
    }, true);
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

function formatTo12Hour(timeStr) {
  if (!timeStr) return "";
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
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
      const labels = {
        Fajr: "فجر",
        Dhuhr: "ظهر",
        Asr: "عصر",
        Maghrib: "مغرب",
        Isha: "عشاء",
      };

      listEl.innerHTML = "";
      order.forEach((name) => {
        const timeVal = t[name];
        if (!timeVal) return;

        const row = document.createElement("div");
        row.className = "prayer-row";

        const label = document.createElement("span");
        label.className = "prayer-name";
        label.textContent = labels[name] || name;

        const time = document.createElement("span");
        time.className = "prayer-time";
        time.textContent = formatTo12Hour(timeVal);

        row.appendChild(time);
        row.appendChild(label);
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
      // Just before we switch days, record today's completion
      const completion = computeOverallCompletionRatio();
      logDayCompletion(stored, completion);

      // Roll tasks forward:
      //  - carry over incomplete Daily To-Do items
      //  - add everything from Tomorrow To-Do
      //  - clear Tomorrow list
      rolloverTasksToNextDay();

      // Update lastDay key to the new day
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

  initWeatherUI();
  initWeatherAutoRefresh();
});

// Raw access to checklist data in localStorage (by id like "dailyTasks")
function getChecklistData(saveId) {
  const raw = localStorage.getItem("dash_" + saveId);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error("Bad checklist data for", saveId, e);
    return [];
  }
}

function setChecklistData(saveId, items) {
  localStorage.setItem("dash_" + saveId, JSON.stringify(items || []));
}

// Move incomplete daily tasks + all tomorrow tasks into new day's Daily To-Do
function rolloverTasksToNextDay() {
  const todayTasks = getChecklistData("dailyTasks");
  const tomorrowTasks = getChecklistData("tomorrowTasks");

  // Incomplete tasks from today (unchecked, non-empty label)
  const incomplete = todayTasks.filter(
    (item) =>
      item &&
      !item.checked &&
      (item.label || "").trim() !== ""
  );

  // Tasks explicitly planned for tomorrow (ignore checked status, just labels)
  const planned = tomorrowTasks.filter(
    (item) =>
      item &&
      (item.label || "").trim() !== ""
  );

  // New day's task list: all carried + planned, all start unchecked
  const nextDayTasks = [
    ...incomplete.map((item) => ({
      label: item.label,
      checked: false,
    })),
    ...planned.map((item) => ({
      label: item.label,
      checked: false,
    })),
  ];

  // Save into dailyTasks for the new day, clear tomorrowTasks
  setChecklistData("dailyTasks", nextDayTasks);
  setChecklistData("tomorrowTasks", []);

  // Refresh UI if the page is open at midnight
  loadChecklists();
  updateProgressRing();
}

function pruneEmptyItems(listEl) {
  listEl.querySelectorAll(".check-item").forEach((item) => {
    const label = item.querySelector(".label");
    if (!label) return;
    if ((label.textContent || "").trim() === "") {
      item.remove();
    }
  });
}


// ---------- WEATHER ----------
function initWeatherUI() {
  const tempEl = document.querySelector(".weather-temp");
  const detailEl = document.querySelector(".weather-detail");
  const lowEl = document.querySelector(".weather-low");
  const highEl = document.querySelector(".weather-high");

  const handleInput = () => updateWeatherUI();
  if (tempEl) tempEl.addEventListener("input", handleInput);
  if (detailEl) detailEl.addEventListener("input", handleInput);
  if (lowEl) lowEl.addEventListener("input", handleInput);
  if (highEl) highEl.addEventListener("input", handleInput);

  updateWeatherUI();
}

function updateWeatherUI() {
  const tempEl = document.querySelector(".weather-temp");
  const detailEl = document.querySelector(".weather-detail");
  const lowEl = document.querySelector(".weather-low");
  const highEl = document.querySelector(".weather-high");
  const recoEl = document.getElementById("weatherRecommendation");

  if (!tempEl || !detailEl || !recoEl) return;

  const tempText = (tempEl.textContent || "").trim();
  const detailText = (detailEl.textContent || "").trim();
  const lowText = (lowEl && lowEl.textContent) ? lowEl.textContent.trim() : "";
  const highText = (highEl && highEl.textContent) ? highEl.textContent.trim() : "";

  const { low, high } = parseTemps(tempText, detailText, lowText, highText);
  const suggestion = buildOutfitSuggestion(low, high, detailText);
  recoEl.textContent = suggestion;

  const iconKind = pickWeatherIcon(detailText);
  renderWeatherIcon(iconKind);
}

function parseTemps(tempText, detailText, lowText = "", highText = "") {
  const nums = [
    ...tempText.matchAll(/-?\d+(?:\.\d+)?/g),
    ...detailText.matchAll(/-?\d+(?:\.\d+)?/g),
    ...lowText.matchAll(/-?\d+(?:\.\d+)?/g),
    ...highText.matchAll(/-?\d+(?:\.\d+)?/g),
  ].map((m) => parseFloat(m[0]));

  if (!nums.length) return { low: null, high: null };
  const low = Math.min(...nums);
  const high = Math.max(...nums);
  return { low, high };
}

function buildOutfitSuggestion(low, high, detailText) {
  const text = (detailText || "").toLowerCase();
  const mentionsRain =
    text.includes("rain") ||
    text.includes("shower") ||
    text.includes("storm") ||
    text.includes("drizzle");

  if (mentionsRain) {
    return "Rain expected — bring an umbrella or waterproof layer.";
  }

  if (low === null || high === null) {
    return "Set today’s temps to get a wear recommendation.";
  }

  if (low <= 40) {
    return "Really cold — wear a warm jacket or coat with layers.";
  }

  if (low <= 55 && high >= 72) {
    return "Cool morning, warm afternoon — light layers and a removable jacket.";
  }

  if (high <= 65) {
    return "Chilly all day — a hoodie or sweater you can keep on.";
  }

  if (high >= 85) {
    return "Hot — light, breathable layers are best.";
  }

  return "Comfortable — light layers should be perfect.";
}

function pickWeatherIcon(detailText) {
  const text = (detailText || "").toLowerCase();
  if (
    text.includes("rain") ||
    text.includes("shower") ||
    text.includes("storm") ||
    text.includes("drizzle")
  ) {
    return WEATHER_ICON_KIND.RAIN;
  }
  if (
    text.includes("cloud") ||
    text.includes("overcast") ||
    text.includes("fog") ||
    text.includes("haze")
  ) {
    return WEATHER_ICON_KIND.CLOUDY;
  }
  return WEATHER_ICON_KIND.SUNNY;
}

function renderWeatherIcon(kind) {
  const iconEl = document.querySelector(".weather-icon");
  if (!iconEl) return;

  const icons = {
    [WEATHER_ICON_KIND.SUNNY]: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="12" fill="#e9ddaf" stroke="#c7ad6f" stroke-width="2"/>
        <g stroke="#e9ddaf" stroke-width="2.5" stroke-linecap="round">
          <line x1="32" y1="6" x2="32" y2="14"/>
          <line x1="32" y1="50" x2="32" y2="58"/>
          <line x1="6" y1="32" x2="14" y2="32"/>
          <line x1="50" y1="32" x2="58" y2="32"/>
          <line x1="14" y1="14" x2="20" y2="20"/>
          <line x1="44" y1="44" x2="50" y2="50"/>
          <line x1="14" y1="50" x2="20" y2="44"/>
          <line x1="44" y1="20" x2="50" y2="14"/>
        </g>
      </svg>
    `,
    [WEATHER_ICON_KIND.CLOUDY]: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M24 42c-6 0-11-4-11-9s5-9 11-9c1.6 0 3.2.3 4.6.9C29.7 20.8 33.5 18 38 18c6.3 0 11.5 5.1 11.5 11.4 0 .2 0 .5-.1.7 3.4 0.9 6 4 6 7.9 0 4.4-3.6 8-8 8H24z" fill="rgba(233,221,175,0.22)" stroke="rgba(233,221,175,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    [WEATHER_ICON_KIND.RAIN]: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M24 40c-6 0-11-4-11-9s5-9 11-9c1.6 0 3.2.3 4.6.9C29.7 18.8 33.5 16 38 16c6.3 0 11.5 5.1 11.5 11.4 0 .2 0 .5-.1.7 3.4 0.9 6 4 6 7.9 0 4.4-3.6 8-8 8H24z" fill="rgba(233,221,175,0.22)" stroke="rgba(233,221,175,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <g stroke="#7b9c6b" stroke-width="2.4" stroke-linecap="round">
          <line x1="24" y1="46" x2="21" y2="54"/>
          <line x1="32" y1="46" x2="29" y2="54"/>
          <line x1="40" y1="46" x2="37" y2="54"/>
        </g>
      </svg>
    `,
  };

  iconEl.innerHTML = icons[kind] || icons[WEATHER_ICON_KIND.SUNNY];
}

function describeWeatherCode(code) {
  const c = Number(code);
  if (c === 0) return { desc: "Clear sky", kind: WEATHER_ICON_KIND.SUNNY };
  if (c === 1 || c === 2) return { desc: "Mostly clear", kind: WEATHER_ICON_KIND.SUNNY };
  if (c === 3 || c === 45 || c === 48) return { desc: "Cloudy", kind: WEATHER_ICON_KIND.CLOUDY };
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) {
    return { desc: "Rain showers", kind: WEATHER_ICON_KIND.RAIN };
  }
  if (c >= 95) return { desc: "Stormy", kind: WEATHER_ICON_KIND.RAIN };
  return { desc: "Partly cloudy", kind: WEATHER_ICON_KIND.CLOUDY };
}

function applyWeatherData({ current, min, max, code }) {
  const tempEl = document.querySelector(".weather-temp");
  const rangeEl = document.querySelector(".weather-range");
  const lowEl = document.querySelector(".weather-low");
  const highEl = document.querySelector(".weather-high");
  const detailEl = document.querySelector(".weather-detail");

  const { desc, kind } = describeWeatherCode(code);

  if (tempEl && current != null) tempEl.textContent = `${Math.round(current)}°F`;
  if (rangeEl && min != null && max != null) rangeEl.textContent = `${Math.round(min)}° / ${Math.round(max)}°`;
  if (lowEl && min != null) lowEl.textContent = `Min ${Math.round(min)}°F`;
  if (highEl && max != null) highEl.textContent = `Max ${Math.round(max)}°F`;
  if (detailEl) detailEl.textContent = desc;

  renderWeatherIcon(kind);
  updateWeatherUI();
}

function fetchLiveWeather() {
  const loc = DEFAULT_LOCATION;
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${loc.lat}&longitude=${loc.lon}` +
    "&current_weather=true" +
    "&daily=temperature_2m_max,temperature_2m_min" +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (!data || !data.current_weather || !data.daily) {
        throw new Error("Bad weather response");
      }
      const current = data.current_weather.temperature;
      const code = data.current_weather.weathercode;
      const min = data.daily.temperature_2m_min ? data.daily.temperature_2m_min[0] : null;
      const max = data.daily.temperature_2m_max ? data.daily.temperature_2m_max[0] : null;

      applyWeatherData({ current, min, max, code });
    })
    .catch((err) => {
      console.error("Weather fetch failed", err);
    });
}

function initWeatherAutoRefresh() {
  fetchLiveWeather();
  // Refresh every 15 minutes for near real-time updates
  setInterval(fetchLiveWeather, 15 * 60 * 1000);
}
