const STORAGE_KEY = "balancr_state";
const COLORS = { Work: "#f97316", Play: "#22c55e", Health: "#38bdf8", Study: "#a78bfa", Other: "#94a3b8" };
const AB_STORAGE_KEY = "balancr_ab_events";

function logABEvent(event) {
  try {
    const list = JSON.parse(localStorage.getItem(AB_STORAGE_KEY) || "[]");
    list.push({ ...event, ts: Date.now() });
    localStorage.setItem(AB_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
  }
  try {
    if (event.type === "view") gaTrack("view_add_activity", { variant: event.variant });
    if (event.type === "submit") gaTrack("submit_activity", { variant: event.variant, time_ms: event.time_ms });
    if (event.type === "preset") gaTrack("preset_click", { variant: event.variant, minutes: event.minutes });
  } catch (e) {
  }
}

function gaTrack(name, params) {
  try {
    if (window.gtag && window.GA_MEASUREMENT_ID) window.gtag("event", name, params || {});
  } catch (e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, activities: [] };
    return JSON.parse(raw);
  } catch (e) {
    return { user: null, activities: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureSeed(state) {
  if (state.activities.length === 0) {
    state.activities = [
      { title: "Deep work", category: "Work", minutes: 90 },
      { title: "Gym", category: "Health", minutes: 60 },
      { title: "Gaming", category: "Play", minutes: 45 },
      { title: "Lecture", category: "Study", minutes: 75 },
      { title: "Walk", category: "Other", minutes: 30 }
    ];
    saveState(state);
  }
}

function addActivity(state, item) {
  state.activities.push(item);
  saveState(state);
}

function aggregateByCategory(activities) {
  const totals = {};
  for (const a of activities) {
    totals[a.category] = (totals[a.category] || 0) + Number(a.minutes || 0);
  }
  const entries = Object.entries(totals).map(([category, minutes]) => ({ category, minutes }));
  const sum = entries.reduce((acc, x) => acc + x.minutes, 0) || 1;
  return entries.map(x => ({ ...x, pct: x.minutes / sum }));
}

function renderHome(state) {
  const el = document.getElementById("home-status");
  if (!el) return;
  const name = state.user?.name;
  el.textContent = name ? `Signed in as ${name}` : "No account yet";
}

function initSignup(state) {
  const form = document.getElementById("signup-form");
  const status = document.getElementById("signup-status");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    if (!name || !email) return;
    state.user = { name, email };
    saveState(state);
    status.textContent = "Account created";
  });
}

function initAddActivity(state) {
  const form = document.getElementById("activity-form");
  const status = document.getElementById("activity-status");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("act-title").value.trim();
    const category = document.getElementById("act-category").value;
    const minutes = Number(document.getElementById("act-minutes").value);
    if (!title || !minutes) return;
    addActivity(state, { title, category, minutes });
    status.textContent = "Activity added";
    form.reset();
  });
}

function initAddActivityA(state) {
  const form = document.getElementById("activity-form");
  const status = document.getElementById("activity-status");
  if (!form) return;
  const start = performance.now();
  logABEvent({ variant: "A", type: "view" });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const title = document.getElementById("act-title").value.trim();
    const category = document.getElementById("act-category").value;
    const minutes = Number(document.getElementById("act-minutes").value);
    if (!title || !minutes) return;
    addActivity(state, { title, category, minutes });
    status.textContent = "Activity added";
    const t = performance.now() - start;
    logABEvent({ variant: "A", type: "submit", time_ms: Math.round(t) });
    form.reset();
  });
}

function initAddActivityB(state) {
  const form = document.getElementById("activity-form-b");
  const status = document.getElementById("activity-status-b");
  if (!form) return;
  const start = performance.now();
  logABEvent({ variant: "B", type: "view" });
  const minutesEl = document.getElementById("act-minutes-b");
  const titleEl = document.getElementById("act-title-b");
  const presetButtons = document.querySelectorAll(".preset-btn");
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = Number(btn.dataset.mins);
      minutesEl.value = String(val);
      titleEl.focus();
      logABEvent({ variant: "B", type: "preset", minutes: val });
    });
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    const title = titleEl.value.trim();
    const category = document.getElementById("act-category-b").value;
    const minutes = Number(minutesEl.value);
    if (!title || !minutes) return;
    addActivity(state, { title, category, minutes });
    status.textContent = "Added";
    const t = performance.now() - start;
    logABEvent({ variant: "B", type: "submit", time_ms: Math.round(t) });
    form.reset();
  });
}

function initActivities(state) {
  const list = document.getElementById("activity-list");
  if (!list) return;
  list.innerHTML = "";
  for (const a of state.activities) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.textContent = `${a.title} • ${a.category}`;
    const right = document.createElement("div");
    right.textContent = `${a.minutes} min`;
    li.append(left, right);
    list.appendChild(li);
  }
}

function renderPieChart(state) {
  const mount = document.getElementById("chart");
  const legend = document.getElementById("chart-legend");
  if (!mount || !legend) return;
  const data = aggregateByCategory(state.activities);
  const size = 220;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  mount.innerHTML = "";
  legend.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${size/2}, ${size/2})`);
  svg.appendChild(g);
  let offset = 0;
  for (const seg of data) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", radius);
    circle.setAttribute("cx", 0);
    circle.setAttribute("cy", 0);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", COLORS[seg.category] || "#64748b");
    circle.setAttribute("stroke-width", 24);
    const length = seg.pct * circumference;
    circle.setAttribute("stroke-dasharray", `${length} ${circumference - length}`);
    circle.setAttribute("stroke-dashoffset", String(-offset));
    circle.setAttribute("transform", "rotate(-90)");
    g.appendChild(circle);
    offset += length;
    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = COLORS[seg.category] || "#64748b";
    const name = document.createElement("div");
    name.textContent = seg.category;
    const pct = document.createElement("div");
    pct.textContent = `${Math.round(seg.pct*100)}%`;
    legend.append(sw, name, pct);
  }
  mount.appendChild(svg);
}

function boot() {
  const state = loadState();
  ensureSeed(state);
  const page = document.body.dataset.page;
  if (page === "home") renderHome(state);
  if (page === "signup") initSignup(state);
  if (page === "add-activity") initAddActivity(state);
  if (page === "add-activity-a") initAddActivityA(state);
  if (page === "add-activity-b") initAddActivityB(state);
  if (page === "activities") initActivities(state);
  if (page === "dashboard") renderPieChart(state);
}

document.addEventListener("DOMContentLoaded", boot);
