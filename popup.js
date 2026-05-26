/* ═══════════════════════════════════════════════
   JHATKAL — popup.js
   Complete popup controller
═══════════════════════════════════════════════ */

'use strict';

// ─── Station data (sample – expand as needed) ───────────────────────────────
const STATIONS = [
  { code: 'NDLS', name: 'New Delhi' },
  { code: 'NZM',  name: 'Hazrat Nizamuddin' },
  { code: 'DEE',  name: 'Delhi Sarai Rohilla' },
  { code: 'CSTM', name: 'Mumbai CSMT' },
  { code: 'BCT',  name: 'Mumbai Central' },
  { code: 'MAS',  name: 'Chennai Central' },
  { code: 'SBC',  name: 'KSR Bengaluru' },
  { code: 'HWH',  name: 'Howrah Junction' },
  { code: 'PUNE', name: 'Pune Junction' },
  { code: 'ADI',  name: 'Ahmedabad Junction' },
  { code: 'JP',   name: 'Jaipur Junction' },
  { code: 'LKO',  name: 'Lucknow Charbagh' },
  { code: 'CNB',  name: 'Kanpur Central' },
  { code: 'PNBE', name: 'Patna Junction' },
  { code: 'GHY',  name: 'Guwahati' },
  { code: 'BBS',  name: 'Bhubaneswar' },
  { code: 'HYB',  name: 'Hyderabad Deccan' },
  { code: 'SC',   name: 'Secunderabad Junction' },
  { code: 'ERS',  name: 'Ernakulam Junction' },
  { code: 'TVC',  name: 'Thiruvananthapuram' },
  { code: 'AGC',  name: 'Agra Cantt' },
  { code: 'MTJ',  name: 'Mathura Junction' },
  { code: 'VSKP', name: 'Visakhapatnam' },
  { code: 'NGP',  name: 'Nagpur Junction' },
  { code: 'R',    name: 'Raipur Junction' },
  { code: 'BSP',  name: 'Bilaspur Junction' },
  { code: 'JHS',  name: 'Jhansi Junction' },
  { code: 'BPL',  name: 'Bhopal Junction' },
  { code: 'UBL',  name: 'Hubballi Junction' },
  { code: 'MYS',  name: 'Mysuru Junction' },
];

// ─── State ─────────────────────────────────────────────────────────────────
const state = {
  acMode: false,
  savedRoutes: [],
  passengers: [],
  selectedRouteIdx: -1,
  irctcDetected: false,
};

let timerInterval = null;

// ─── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ─── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStorage();
  initTabs();
  initACToggle();
  initTimer();
  initAutocomplete('fromStation', 'fromList');
  initAutocomplete('toStation', 'toList');
  initSwap();
  initSaveRoute();
  initPassengers();
  initCTA();
  initLogin();
  checkIRCTCPage();
  setDefaultDate();
});

// ─── Storage ─────────────────────────────────────────────────────────────────
function loadStorage() {
  try {
    const saved = localStorage.getItem('jhatkal_routes');
    if (saved) state.savedRoutes = JSON.parse(saved);
    const pax = localStorage.getItem('jhatkal_passengers');
    if (pax) state.passengers = JSON.parse(pax);
    const ac = localStorage.getItem('jhatkal_ac');
    if (ac !== null) state.acMode = JSON.parse(ac);
  } catch (e) { /* ignore */ }
  renderSavedRoutes();
  renderPassengers();
  applyACToggleUI();
  loadCredentials();
}

function saveRoutesToStorage() {
  localStorage.setItem('jhatkal_routes', JSON.stringify(state.savedRoutes));
}
function savePassengersToStorage() {
  localStorage.setItem('jhatkal_passengers', JSON.stringify(state.passengers));
}

// ─── Tabs ─────────────────────────────────────────────────────────────────
function loadCredentials() {
  chrome.storage.local.get('jhatkal_credentials', items => {
    const cred = items.jhatkal_credentials;
    if (cred) {
      const uidEl = $('irctcUserId');
      const pwdEl = $('irctcPassword');
      if (uidEl) uidEl.value = cred.userId || '';
      if (pwdEl) pwdEl.value = cred.password || '';
    }
  });
}

function initLogin() {
  const saveBtn = $('saveLoginBtn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', () => {
    const userId = $('irctcUserId').value.trim();
    const password = $('irctcPassword').value;
    if (!userId || !password) {
      showToast('⚠️ Enter both User ID and Password');
      return;
    }
    chrome.storage.local.set({ jhatkal_credentials: { userId, password } }, () => {
      showToast('✅ Login saved!');
    });
  });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────
function initTabs() {
  const btns   = $$('.tab-btn');
  const slider = $('tabSlider');

  function moveSlider(btn) {
    const barRect  = btn.closest('.tab-bar').getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();
    slider.style.left  = (btnRect.left - barRect.left) + 'px';
    slider.style.width = btnRect.width + 'px';
  }

  // Initial position
  moveSlider(document.querySelector('.tab-btn.active'));

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      $(`panel-${target}`).classList.add('active');
      moveSlider(btn);
    });
  });
}

// ─── AC Toggle ───────────────────────────────────────────────────────────────
function initACToggle() {
  $('acToggle').addEventListener('click', () => {
    state.acMode = !state.acMode;
    applyACToggleUI();
    localStorage.setItem('jhatkal_ac', JSON.stringify(state.acMode));
    updateTimerHint();
  });
}
function applyACToggleUI() {
  const btn  = $('acToggle');
  const lbl  = $('acLabel');
  if (state.acMode) {
    btn.classList.add('on');
    btn.setAttribute('aria-checked', 'true');
    lbl.style.color = '#6ea6ff';
  } else {
    btn.classList.remove('on');
    btn.setAttribute('aria-checked', 'false');
    lbl.style.color = '';
  }
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function initTimer() {
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function getTatkalOpenTime(ac) {
  const now = new Date();
  const target = new Date(now);
  target.setSeconds(0);
  target.setMilliseconds(0);
  if (ac) {
    target.setHours(10, 0, 0, 0);
  } else {
    target.setHours(11, 0, 0, 0);
  }
  // If already past today's time, show tomorrow's
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function updateTimer() {
  const openTime = getTatkalOpenTime(state.acMode);
  const now      = new Date();
  const diffMs   = openTime - now;
  const diffSec  = Math.max(0, Math.floor(diffMs / 1000));

  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;

  $('timerDisplay').textContent =
    String(h).padStart(2,'0') + ':' +
    String(m).padStart(2,'0') + ':' +
    String(s).padStart(2,'0');

  // Progress bar: full 24 h window
  const totalSec = 24 * 3600;
  const pct      = 1 - (diffSec / totalSec);
  const barW     = Math.max(2, Math.round((1 - pct) * 100));
  const bar      = $('timerBar');
  bar.style.width = barW + '%';

  // Color coding
  if (diffSec > 7200) {
    bar.style.background = 'var(--bar-green)';
    bar.style.boxShadow  = '0 0 8px var(--bar-green)';
  } else if (diffSec > 1800) {
    bar.style.background = 'var(--bar-yellow)';
    bar.style.boxShadow  = '0 0 8px var(--bar-yellow)';
  } else {
    bar.style.background = 'var(--bar-red)';
    bar.style.boxShadow  = '0 0 8px var(--bar-red)';
  }
}

function updateTimerHint() {
  $('timerHint').textContent = state.acMode
    ? 'AC opens at 10:00 AM · Non-AC at 11:00 AM'
    : 'Non-AC opens at 11:00 AM · AC at 10:00 AM';
}

// ─── Autocomplete ────────────────────────────────────────────────────────────
function initAutocomplete(inputId, listId) {
  const input = $(inputId);
  const list  = $(listId);

  input.addEventListener('input', () => {
    const q = input.value.trim().toUpperCase();
    if (q.length < 1) { list.classList.remove('show'); return; }

    const matches = STATIONS.filter(s =>
      s.code.startsWith(q) ||
      s.name.toUpperCase().includes(q)
    ).slice(0, 6);

    if (!matches.length) { list.classList.remove('show'); return; }

    list.innerHTML = matches.map(s =>
      `<li data-code="${s.code}"><strong>${s.code}</strong><span>${s.name}</span></li>`
    ).join('');
    list.classList.add('show');
  });

  list.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    input.value = li.dataset.code;
    list.classList.remove('show');
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.classList.remove('show');
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') list.classList.remove('show');
  });
}

// ─── Swap stations ────────────────────────────────────────────────────────────
function initSwap() {
  $('swapBtn').addEventListener('click', () => {
    const a = $('fromStation').value;
    const b = $('toStation').value;
    $('fromStation').value = b;
    $('toStation').value   = a;
  });
}

// ─── Default Date ─────────────────────────────────────────────────────────────
function setDefaultDate() {
  const t = new Date();
  t.setDate(t.getDate() + 1); // default to tomorrow
  const iso = t.toISOString().split('T')[0];
  $('travelDate').value = iso;
  $('travelDate').min   = new Date().toISOString().split('T')[0];
}

// ─── Save Route ────────────────────────────────────────────────────────────────
function initSaveRoute() {
  $('saveRouteBtn').addEventListener('click', () => {
    const from  = $('fromStation').value.trim().toUpperCase();
    const to    = $('toStation').value.trim().toUpperCase();
    const date  = $('travelDate').value;
    const cls   = $('trainClass').value;

    if (!from || !to) { showToast('⚠️ Enter both station codes'); return; }
    if (from === to)  { showToast('⚠️ From & To cannot be same'); return; }

    // Avoid duplicate
    const exists = state.savedRoutes.find(r =>
      r.from === from && r.to === to && r.cls === cls
    );
    if (exists) { showToast('Route already saved!'); return; }

    const route = { from, to, date, cls, id: Date.now() };
    state.savedRoutes.unshift(route);
    saveRoutesToStorage();
    renderSavedRoutes();
    showToast('✅ Route saved!');
  });
}

function renderSavedRoutes() {
  const container = $('savedRoutesList');
  const empty     = $('routesEmptyState');
  const cnt       = $('routeCount');
  cnt.textContent = state.savedRoutes.length;

  if (!state.savedRoutes.length) {
    container.innerHTML = '';
    container.appendChild(empty);
    return;
  }

  const html = state.savedRoutes.map((r, i) => `
    <div class="route-card ${state.selectedRouteIdx === i ? 'selected' : ''}" data-idx="${i}">
      <div class="route-stations">
        <span class="route-code">${r.from}</span>
        <span class="route-arrow">→</span>
        <span class="route-code">${r.to}</span>
        <div>
          <div class="route-meta">${r.date || 'No date'}</div>
        </div>
      </div>
      <span class="route-class-badge">${r.cls}</span>
      <button class="route-del-btn" data-del="${i}" title="Remove">×</button>
    </div>
  `).join('');
  container.innerHTML = html;

  // Select route
  container.querySelectorAll('.route-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.dataset.del !== undefined) return;
      const idx = +card.dataset.idx;
      state.selectedRouteIdx = state.selectedRouteIdx === idx ? -1 : idx;
      if (state.selectedRouteIdx >= 0) {
        const r = state.savedRoutes[idx];
        $('fromStation').value = r.from;
        $('toStation').value   = r.to;
        $('travelDate').value  = r.date || '';
        $('trainClass').value  = r.cls;
        showToast('Route loaded!');
      }
      renderSavedRoutes();
    });
  });

  // Delete route
  container.querySelectorAll('.route-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = +btn.dataset.del;
      state.savedRoutes.splice(idx, 1);
      if (state.selectedRouteIdx === idx) state.selectedRouteIdx = -1;
      saveRoutesToStorage();
      renderSavedRoutes();
      showToast('Route removed');
    });
  });
}

// ─── Passengers ────────────────────────────────────────────────────────────────
const BERTH_OPTIONS  = ['No Preference','Lower','Middle','Upper','Side Lower','Side Upper'];
const GENDER_OPTIONS = ['Male','Female','Transgender'];
const FOOD_OPTIONS   = ['No Preference','Veg','Non-Veg','Jain'];
const MAX_PAX = 6;

function initPassengers() {
  $('addPassengerBtn').addEventListener('click', addPassenger);

  // Template chips
  $$('.template-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.template-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyTemplate(chip.dataset.template);
    });
  });

  renderPassengers();
}

function applyTemplate(tpl) {
  state.passengers = [];
  if (tpl === 'solo') {
    addPassengerData({ name:'', age:'', gender:'Male', berth:'No Preference', food:'No Preference' });
  } else if (tpl === 'family') {
    addPassengerData({ name:'', age:'', gender:'Male',   berth:'Lower',      food:'No Preference' });
    addPassengerData({ name:'', age:'', gender:'Female', berth:'Lower',      food:'No Preference' });
    addPassengerData({ name:'', age:'12', gender:'Male', berth:'Middle',     food:'No Preference' });
  } else if (tpl === 'friends') {
    for (let i = 0; i < 3; i++) {
      addPassengerData({ name:'', age:'', gender:'Male', berth:'No Preference', food:'No Preference' });
    }
  }
  renderPassengers();
  savePassengersToStorage();
}

function addPassengerData(data) {
  if (state.passengers.length >= MAX_PAX) return;
  state.passengers.push({ id: Date.now() + Math.random(), ...data });
}

function addPassenger() {
  if (state.passengers.length >= MAX_PAX) {
    showToast('Maximum 6 passengers allowed');
    return;
  }
  addPassengerData({ name:'', age:'', gender:'Male', berth:'No Preference', food:'No Preference' });
  renderPassengers();
  savePassengersToStorage();
}

function renderPassengers() {
  const list = $('passengerList');
  const cnt  = $('paxCount');
  const addBtn = $('addPassengerBtn');
  cnt.textContent = `${state.passengers.length} / ${MAX_PAX}`;
  addBtn.disabled = state.passengers.length >= MAX_PAX;

  if (!state.passengers.length) {
    list.innerHTML = `
      <div class="empty-state" style="margin-bottom:12px">
        <div class="empty-icon">🧳</div>
        <p class="empty-title">No passengers added</p>
        <p class="empty-sub">Pick a template or add manually</p>
      </div>`;
    return;
  }

  list.innerHTML = state.passengers.map((p, i) => `
    <div class="passenger-card" data-paxid="${p.id}">
      <div class="passenger-card-header">
        <span class="passenger-num">Passenger ${i + 1}</span>
        <button class="passenger-del-btn" data-paxdel="${i}" title="Remove">×</button>
      </div>

      <div class="field-group" style="margin-bottom:8px">
        <label class="field-label">Full Name</label>
        <input type="text" class="field-input pax-name" data-idx="${i}"
          value="${escHtml(p.name)}" placeholder="As on ID card" />
      </div>

      <div class="pax-grid-3" style="margin-bottom:8px">
        <div class="field-group">
          <label class="field-label">Age</label>
          <input type="number" class="field-input pax-age" data-idx="${i}"
            value="${escHtml(String(p.age))}" placeholder="--" min="1" max="125" />
        </div>
        <div class="field-group">
          <label class="field-label">Gender</label>
          <select class="field-input pax-gender" data-idx="${i}">
            ${GENDER_OPTIONS.map(g =>
              `<option ${p.gender===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label class="field-label">Food</label>
          <select class="field-input pax-food" data-idx="${i}">
            ${FOOD_OPTIONS.map(f =>
              `<option ${p.food===f?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">Berth Preference</label>
        <select class="field-input pax-berth" data-idx="${i}">
          ${BERTH_OPTIONS.map(b =>
            `<option ${p.berth===b?'selected':''}>${b}</option>`).join('')}
        </select>
      </div>
    </div>
  `).join('');

  // Bind inputs
  list.querySelectorAll('.pax-name').forEach(el => {
    el.addEventListener('input', e => {
      state.passengers[+e.target.dataset.idx].name = e.target.value;
      savePassengersToStorage();
    });
  });
  list.querySelectorAll('.pax-age').forEach(el => {
    el.addEventListener('input', e => {
      state.passengers[+e.target.dataset.idx].age = e.target.value;
      savePassengersToStorage();
    });
  });
  list.querySelectorAll('.pax-gender').forEach(el => {
    el.addEventListener('change', e => {
      state.passengers[+e.target.dataset.idx].gender = e.target.value;
      savePassengersToStorage();
    });
  });
  list.querySelectorAll('.pax-berth').forEach(el => {
    el.addEventListener('change', e => {
      state.passengers[+e.target.dataset.idx].berth = e.target.value;
      savePassengersToStorage();
    });
  });
  list.querySelectorAll('.pax-food').forEach(el => {
    el.addEventListener('change', e => {
      state.passengers[+e.target.dataset.idx].food = e.target.value;
      savePassengersToStorage();
    });
  });

  // Delete
  list.querySelectorAll('.passenger-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.passengers.splice(+btn.dataset.paxdel, 1);
      renderPassengers();
      savePassengersToStorage();
    });
  });
}

// ─── CTA / Autofill ────────────────────────────────────────────────────────────
function initCTA() {
  $('autofillBtn').addEventListener('click', async () => {
    if (!state.irctcDetected) {
      showToast('⚠️ Open the IRCTC booking page first');
      return;
    }
    if (!state.passengers.length) {
      showToast('⚠️ Add at least one passenger');
      return;
    }

    const btn = $('autofillBtn');
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
    btn.querySelector('.cta-text').textContent = 'Autofilling…';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, {
        action: 'autofill',
        data: {
          from:       $('fromStation').value,
          to:         $('toStation').value,
          date:       $('travelDate').value,
          cls:        $('trainClass').value,
          ac:         state.acMode,
          passengers: state.passengers,
        }
      });
      showToast('⚡ Autofill complete!');
    } catch (err) {
      showToast('Could not contact IRCTC page');
    } finally {
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
      btn.querySelector('.cta-text').innerHTML = 'Autofill Now <em>(Tatkal Ready)</em>';
    }
  });
}

// ─── IRCTC Detection ──────────────────────────────────────────────────────────
async function checkIRCTCPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isIRCTC = tab.url && tab.url.includes('irctc.co.in');
    state.irctcDetected = isIRCTC;
    const dot  = $('statusDot');
    const text = $('statusText');
    if (isIRCTC) {
      dot.classList.add('online');
      dot.classList.remove('offline');
      text.textContent = 'IRCTC page detected ✓';
      text.style.color = 'var(--success)';
    } else {
      dot.classList.add('offline');
      dot.classList.remove('online');
      text.textContent = 'Open IRCTC booking page →';
      text.style.color = 'var(--warning)';
    }
  } catch (e) {
    // Extension context (no tabs API in non-extension environment)
    $('statusText').textContent = 'Extension context only';
  }
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ─── Util ──────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
