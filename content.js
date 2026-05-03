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
  const { from, to, date, cls, passengers } = data;

  // Fill journey details
  await fillJourneyDetails(from, to, date, cls);

  // Fill passenger details after journey section renders
  await delay(600);
  await fillPassengers(passengers);
}

// ─── Fill journey section ─────────────────────────────────────────────────────
async function fillJourneyDetails(from, to, date, cls) {
  // From station
  await fillStation('[placeholder*="From"]', from);
  await delay(300);

  // To station
  await fillStation('[placeholder*="To"]', to);
  await delay(300);

  // Date
  if (date) {
    const dateInput = document.querySelector('p-calendar input, input[placeholder*="DD/MM/YYYY"], input[id*="journey-date"]');
    if (dateInput) {
      const [yr, mo, dy] = date.split('-');
      const ddmmyyyy = `${dy}/${mo}/${yr}`;
      setNativeValue(dateInput, ddmmyyyy);
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      await delay(200);
    }
  }

  // Train class – look for a dropdown or radio
  const clsSelect = document.querySelector('select[formcontrolname*="class"], select[id*="journeyClass"]');
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
  // IRCTC uses a table with repeated rows for passengers
  const rows = document.querySelectorAll(
    '.passenger-details tr[id*="psngr"], .psgn-details tr, table.pax-table tr'
  );

  const nameInputs   = document.querySelectorAll('input[id*="psngr_name_"], input[placeholder*="Passenger Name"]');
  const ageInputs    = document.querySelectorAll('input[id*="psngr_age_"],  input[placeholder*="Age"]');
  const genderSelects= document.querySelectorAll('select[id*="psngr_gender_"], select[placeholder*="Gender"]');
  const berthSelects = document.querySelectorAll('select[id*="psngr_berth_"], select[placeholder*="Berth"]');

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

// ─── Notify background that content script is alive ───────────────────────────
chrome.runtime.sendMessage({ action: 'contentReady', url: location.href }).catch(() => {});