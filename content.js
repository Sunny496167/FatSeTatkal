/* ═══════════════════════════════════════════════
   JHATKAL — content.js
   Injected into https://www.irctc.co.in/*
   Handles autofill on the booking page.
═══════════════════════════════════════════════ */

'use strict';

// ─── Listen for messages from popup ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'autofill') {
    autofill(msg.data)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true; // keep message channel open for async
  }

  if (msg.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }
});

// ─── Autofill orchestrator ────────────────────────────────────────────────────
async function autofill(data) {
  // Attempt login if needed; if login triggered, abort autofill for now
  const ready = await maybeLogin();
  if (!ready) return;

  const { from, to, date, cls, passengers } = data;

  // Fill journey details
  await fillJourneyDetails(from, to, date, cls);

  // Fill passenger details after journey section renders
  await delay(600);
  await fillPassengers(passengers);
}

// ─── Fill journey section ─────────────────────────────────────────────────────
async function fillJourneyDetails(from, to, date, cls) {
  // From station (fallback selector list for various page variations)
  await fillStation('[placeholder*="From"], input[id*="fromStation"], input[name*="fromStation"]', from);
  await delay(300);

  // To station (fallback selector list)
  await fillStation('[placeholder*="To"], input[id*="toStation"], input[name*="toStation"]', to);
  await delay(300);

  // Date (fallback selector list for date inputs)
  if (date) {
    const dateInput = document.querySelector('p-calendar input, input[placeholder*="DD/MM/YYYY"], input[id*="journey-date"], input[name*="journeyDate"]');
    if (dateInput) {
      const [yr, mo, dy] = date.split('-');
      const ddmmyyyy = `${dy}/${mo}/${yr}`;
      setNativeValue(dateInput, ddmmyyyy);
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      await delay(200);
    }
  }

  // Train class – look for a dropdown or radio (fallback selector list)
  const clsSelect = document.querySelector('select[formcontrolname*="class"], select[id*="journeyClass"], select[name*="class"]');
  if (clsSelect) {
    selectOption(clsSelect, cls);
  }
}

// ─── Station helper ────────────────────────────────────────────────────────────
async function fillStation(selector, code) {
  const input = document.querySelector(selector);
  if (!input) return;
  input.focus();
  setNativeValue(input, code);
  input.dispatchEvent(new Event('input',  { bubbles: true }));
  input.dispatchEvent(new Event('keyup',  { bubbles: true }));
  await delay(400);

  // Pick first autocomplete suggestion
  const suggestion = document.querySelector(
    '.ui-autocomplete-list-item, .ac-station, [class*="suggestion"] li, mat-option'
  );
  if (suggestion) suggestion.click();
}

// ─── Fill passenger rows ───────────────────────────────────────────────────────
async function fillPassengers(passengers) {
  for (let i = 0; i < passengers.length; i++) {
    await fillPassengerRow(i, passengers[i]);
    await delay(250);
  }
}

async function fillPassengerRow(idx, pax) {
  // IRCTC uses a table with repeated rows for passengers (fallback selectors for rows)
  const rows = document.querySelectorAll(
    '.passenger-details tr[id*="psngr"], .psgn-details tr, table.pax-table tr, tr[data-passenger-row]'
  );

  // Extend selectors for passenger inputs to cover more page variations
  const nameInputs   = document.querySelectorAll('input[id*="psngr_name_"], input[placeholder*="Passenger Name"], input[name*="passengerName"], input[name*="name"]');
  const ageInputs    = document.querySelectorAll('input[id*="psngr_age_"], input[placeholder*="Age"], input[name*="age"]');
  const genderSelects= document.querySelectorAll('select[id*="psngr_gender_"], select[placeholder*="Gender"], select[name*="gender"]');
  const berthSelects = document.querySelectorAll('select[id*="psngr_berth_"], select[placeholder*="Berth"], select[name*="berth"]');

  if (nameInputs[idx]) {
    setNativeValue(nameInputs[idx], pax.name.toUpperCase());
    nameInputs[idx].dispatchEvent(new Event('input',  { bubbles: true }));
    nameInputs[idx].dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (ageInputs[idx]) {
    setNativeValue(ageInputs[idx], String(pax.age));
    ageInputs[idx].dispatchEvent(new Event('input',  { bubbles: true }));
    ageInputs[idx].dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (genderSelects[idx]) {
    const gMap = { 'Male': 'M', 'Female': 'F', 'Transgender': 'T' };
    selectOption(genderSelects[idx], gMap[pax.gender] || pax.gender);
  }

  if (berthSelects[idx]) {
    const bMap = {
      'No Preference': 'GN',
      'Lower':         'LB',
      'Middle':        'MB',
      'Upper':         'UB',
      'Side Lower':    'SL',
      'Side Upper':    'SU',
    };
    selectOption(berthSelects[idx], bMap[pax.berth] || pax.berth);
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
/**
 * Set value on a React / Angular controlled input
 * by using the native input value setter so change events fire correctly.
 */
function setNativeValue(el, value) {
  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');

  if (nativeInputValueSetter) {
    nativeInputValueSetter.set.call(el, value);
  } else {
    el.value = value;
  }
}

function selectOption(selectEl, value) {
  const opts = Array.from(selectEl.options);
  const opt  = opts.find(o =>
    o.value.toUpperCase() === String(value).toUpperCase() ||
    o.text.toUpperCase().includes(String(value).toUpperCase())
  );
  if (opt) {
    selectEl.value = opt.value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Maybe login helper ───────────────────────────────────────────────────────
async function maybeLogin() {
  // Detect login form fields
  const userInput = document.querySelector('input[name="userId"], input[name="loginUserId"], input[id*="userid"], input[id*="userID"], input[name="username"], input[name="user_id"]');
  const pwdInput = document.querySelector('input[name="pwd"], input[name="password"], input[type="password"], input[id*="pwd"], input[id*="password"]');
  if (userInput && pwdInput) {
    // Retrieve stored credentials
    const cred = await new Promise(resolve => {
      chrome.storage.local.get('jhatkal_credentials', items => resolve(items.jhatkal_credentials));
    });
    if (cred && cred.userId && cred.password) {
      setNativeValue(userInput, cred.userId);
      userInput.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(pwdInput, cred.password);
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
      const loginBtn = document.querySelector('button[type="submit"], input[type="submit"], button[name="Login"], input[value="Login"], button[id*="login"], button[class*="login"]');
      if (loginBtn) loginBtn.click();
    }
    // Not logged in yet (login form present)
    return false;
  }
  // Already logged in or no login form
  return true;
}

// ─── Notify background that content script is alive ───────────────────────────
chrome.runtime.sendMessage({ action: 'contentReady', url: location.href }).catch(() => {});