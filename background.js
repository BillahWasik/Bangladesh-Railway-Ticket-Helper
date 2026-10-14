importScripts('shared.js');

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoBookAlarm') {
    const data = await chrome.storage.local.get(['scheduledPath', 'trip', 'autoNewestDate']);
    const { trip, autoNewestDate } = data;
    let path = data.scheduledPath;

    if (trip) {
      // If dynamic auto-newest date is on, calculate 10-day advance date for the actual alarm fire day
      if (autoNewestDate) {
        const todayDate = BRTH.today();
        const targetDoj = BRTH.addDays(todayDate, BRTH.BOOKING_WINDOW_DAYS);
        const dynamicTrip = { ...trip, doj: BRTH.toIso(targetDoj) };
        path = BRTH.searchPath(dynamicTrip);
        await chrome.storage.local.set({ trip: dynamicTrip });
      }

      if (path) {
        const url = BRTH.SITE + path;

        // Arm the automation (same as popup's Search click) so content/results.js immediately books
        await chrome.storage.local.set({ bookArm: { path, at: Date.now() } });

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
