importScripts('shared.js');

const NOTIFICATION_ICON = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"%3E%3Crect width="24" height="24" rx="4"/%3E%3Cpath d="M4 11h16M12 3v8" stroke="%23ffffff" stroke-width="2"/%3E%3C/svg%3E';

function notifyUser(title, message) {
  if (chrome.notifications) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: NOTIFICATION_ICON,
        title: title || 'BR Ticket Helper',
        message: message || '',
        priority: 2,
      });
    } catch {
      /* Notification restriction */
    }
  }
}

// Bring railway tab and window to front when desktop notification is clicked
if (chrome.notifications?.onClicked) {
  chrome.notifications.onClicked.addListener(async () => {
    const tabs = await chrome.tabs.query({ url: "*://eticket.railway.gov.bd/*" });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
  });
}

// Listen for notification requests from content scripts (OTP, Hold warning, etc.)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'notify') {
    notifyUser(msg.title, msg.message);
  }
});

// Schedule session keep-alive heartbeat alarm (every 4 minutes)
chrome.alarms.get('sessionKeepAliveAlarm', (alarm) => {
  if (!alarm) {
    chrome.alarms.create('sessionKeepAliveAlarm', { periodInMinutes: 4 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sessionKeepAliveAlarm') {
    const { settings = {}, login = {}, scheduleTargetTimestamp } = await chrome.storage.local.get(['settings', 'login', 'scheduleTargetTimestamp']);
    if (settings.keepAlive !== false && (login.mobile || scheduleTargetTimestamp)) {
      try {
        await fetch('https://eticket.railway.gov.bd/', { method: 'HEAD', cache: 'no-store' });
      } catch {
        /* Network blip or offline */
      }
    }
    return;
  }

  if (alarm.name === 'autoBookAlarm') {
    const data = await chrome.storage.local.get(['scheduledPath', 'trip', 'autoNewestDate']);
    const { trip, autoNewestDate } = data;
    let path = data.scheduledPath;

    if (trip) {
      // If dynamic auto-newest date is on, calculate 10-day advance date for the actual alarm fire day
      let dynamicTrip = trip;
      if (autoNewestDate) {
        const todayDate = BRTH.today();
        const targetDoj = BRTH.addDays(todayDate, BRTH.BOOKING_WINDOW_DAYS);
        dynamicTrip = { ...trip, doj: BRTH.toIso(targetDoj) };
        path = BRTH.searchPath(dynamicTrip);
        await chrome.storage.local.set({ trip: dynamicTrip });
      }

      if (path) {
        const url = BRTH.SITE + path;

        // Arm the automation (same as popup's Search click) so content/results.js immediately books
        await chrome.storage.local.set({ bookArm: { path, at: Date.now() } });

        // Notify user via native desktop notification
        notifyUser('🎫 Bangladesh Railway Auto-Booking!', `Auto-booking triggered for ${dynamicTrip.from} → ${dynamicTrip.to} (${BRTH.toSiteDate(dynamicTrip.doj)})`);

        // Try to find an existing railway tab, or create a new one
        const tabs = await chrome.tabs.query({ url: "*://eticket.railway.gov.bd/*" });
        if (tabs.length > 0) {
          await chrome.tabs.update(tabs[0].id, { url, active: true });
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url });
        }
      }

      // Clear the schedule since it has fired
      await chrome.storage.local.remove(['scheduleTargetTime', 'scheduleTargetTimestamp', 'scheduledPath', 'autoNewestDate']);
    }
  }
});
