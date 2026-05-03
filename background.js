/* ═══════════════════════════════════════════════
   JHATKAL — background.js
   Service worker (Manifest V3)
═══════════════════════════════════════════════ */

'use strict';

// ─── Install / Activate ────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[Jhatkal] Extension installed. Ready to turbocharge your Tatkal bookings!');
    // Set default alarm for Tatkal open-time reminder
    scheduleAlarm();
  }
});

// ─── Message relay ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'contentReady') {
    // Content script reported in — optionally badge the icon
    if (sender.tab && msg.url && msg.url.includes('irctc.co.in')) {
      setBadge(sender.tab.id, true);
    }
  }
  // All other messages pass through
  sendResponse({ received: true });
  return true;
});

// ─── Tab tracking ──────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isIRCTC = tab.url.includes('irctc.co.in');
    setBadge(tabId, isIRCTC);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    const isIRCTC = tab.url && tab.url.includes('irctc.co.in');
    setBadge(tabId, isIRCTC);
  } catch (_) { /* tab may not exist */ }
});

// ─── Badge helper ──────────────────────────────────────────────────────────────
function setBadge(tabId, active) {
  if (active) {
    chrome.action.setBadgeText({ text: '⚡', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#3d7fff', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

// ─── Alarm: Tatkal reminder ────────────────────────────────────────────────────
function scheduleAlarm() {
  // Remind user 2 minutes before Tatkal opens (10:00 AM AC, 11:00 AM Non-AC)
  // We schedule a daily alarm; actual times handled in the alarm listener.
  chrome.alarms.create('tatkal-ac-reminder', {
    when: nextAlarmTime(9, 58),   // 9:58 AM
    periodInMinutes: 24 * 60,
  });
  chrome.alarms.create('tatkal-nonac-reminder', {
    when: nextAlarmTime(10, 58),  // 10:58 AM
    periodInMinutes: 24 * 60,
  });
}

function nextAlarmTime(hours, minutes) {
  const now  = new Date();
  const t    = new Date();
  t.setHours(hours, minutes, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t.getTime();
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tatkal-ac-reminder') {
    chrome.notifications.create({
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   '⚡ Jhatkal – AC Tatkal in 2 mins!',
      message: 'AC Tatkal opens at 10:00 AM. Open IRCTC and hit Autofill!',
      priority: 2,
    });
  }
  if (alarm.name === 'tatkal-nonac-reminder') {
    chrome.notifications.create({
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   '⚡ Jhatkal – Non-AC Tatkal in 2 mins!',
      message: 'Non-AC Tatkal opens at 11:00 AM. Open IRCTC and hit Autofill!',
      priority: 2,
    });
  }
});
