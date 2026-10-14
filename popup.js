const $ = (id) => document.getElementById(id);
const fields = {
  from: $('from'), to: $('to'), doj: $('doj'), timePref: $('time-pref'), cls: $('cls'), seats: $('seats'), trains: $('trains'),
};

// Don't nag about empty fields until the user has started filling the form.
let touched = false;

init();

async function init() {
  if (BRTH.initTheme) BRTH.initTheme($('theme-toggle'));

  for (const [code, label] of BRTH.CLASSES) {
    fields.cls.append(new Option(`${code} - ${label}`, code));
  }

  // Allow selecting today up to 30 days ahead so future dates and tomorrow's release date can be chosen
  const today = BRTH.today();
  fields.doj.min = BRTH.toIso(today);
  fields.doj.max = BRTH.toIso(BRTH.addDays(today, 30));

  // Quick date preset chips
  setupDateChips(today);

  // v0.3.0 remembered every searched station, typos included. Stations now come only from
  // searches that returned trains (recorded by content/results.js under "stations").
  await chrome.storage.local.remove('stationHistory');

  const {
    trip,
    stations: searched = [],
    login,
    scheduleTargetTime,
    scheduleTargetTimestamp,
    scheduledPath,
    autoNewestDate = false,
  } = await BRTH.load(['trip', 'stations', 'login', 'scheduleTargetTime', 'scheduleTargetTimestamp', 'scheduledPath', 'autoNewestDate']);

  // Populate From and To station dropdowns (Popular Hubs + All Stations A-Z)
  setupStationDropdowns(searched);

  // Populate saved fallback class hierarchy dropdowns
  const savedFallbacks = trip?.fallbackClsList ||
    (trip?.fallbackCls ? trip.fallbackCls.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean) : []);

  $('fallback-list').replaceChildren();
  for (const code of savedFallbacks) {
    addFallbackRow(code);
  }
  updateFallbackEmptyState();

  $('add-fallback-btn').addEventListener('click', () => {
    addFallbackRow();
    onEdit();
  });

  if (trip) {
    touched = true;
    const fromVal = BRTH.canonicalStation(trip.from);
    const toVal = BRTH.canonicalStation(trip.to);
    ensureStationOption(fields.from, fromVal);
    ensureStationOption(fields.to, toVal);
    fields.from.value = fromVal ?? '';
    fields.to.value = toVal ?? '';
    fields.doj.value = trip.doj ?? '';
    if (fields.timePref) fields.timePref.value = trip.timePref ?? 'any';
    fields.cls.value = trip.cls ?? '';
    fields.seats.value = String(trip.seats ?? 1);
    fields.trains.value = trip.trains ?? '';
  }

  // Restore schedule UI if an alarm is actually active
  const alarm = await chrome.alarms.get('autoBookAlarm');
  if (alarm && scheduleTargetTime) {
    showScheduledState(scheduleTargetTime, scheduleTargetTimestamp, scheduledPath, autoNewestDate, trip?.doj);
  } else {
    showUnscheduledState();
  }

  $('login-state').textContent = login?.mobile
    ? `Login: ${login.mobile.slice(0, 3)}••••••${login.mobile.slice(-2)}`
    : 'Login: not set';

  render();

  for (const el of Object.values(fields)) {
    el.addEventListener('input', onEdit);
    el.addEventListener('change', onEdit);
  }

  $('swap').addEventListener('click', () => {
    const fromVal = fields.from.value;
    const toVal = fields.to.value;
    fields.from.value = toVal;
    fields.to.value = fromVal;
    onEdit();
  });

  $('open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  $('go-login').addEventListener('click', async () => {
    await openOnSite('/login');
    window.close();
  });

  $('search').addEventListener('click', onSearch);
  $('schedule-btn').addEventListener('click', onSchedule);
  $('cancel-schedule-btn').addEventListener('click', onCancelSchedule);

  const autoNewestCheckbox = $('auto-newest-date');
  if (autoNewestCheckbox) {
    autoNewestCheckbox.addEventListener('change', () => {
      if (autoNewestCheckbox.checked) {
        // Preset default release time (08:00 AM) if none set
        if (!$('schedule-time').value) $('schedule-time').value = '08:00';
      }
      render();
    });
  }
}

function setupDateChips(today) {
  const tomorrowRelease = BRTH.tomorrowReleaseDate();
  const todayMax = BRTH.todayMaxDate();
  const tomorrow = BRTH.addDays(today, 1);

  const chipTomorrowRelease = $('chip-tomorrow-release');
  if (chipTomorrowRelease) {
    chipTomorrowRelease.textContent = `⭐ Tomorrow's 8 AM Release (${BRTH.toShortDate(tomorrowRelease)})`;
    chipTomorrowRelease.addEventListener('click', () => {
      fields.doj.value = BRTH.toIso(tomorrowRelease);
      $('schedule-time').value = '08:00';
      if ($('auto-newest-date')) $('auto-newest-date').checked = false;
      onEdit();
    });
  }

  const chipTodayMax = $('chip-today-max');
  if (chipTodayMax) {
    chipTodayMax.textContent = `Today's Max (${BRTH.toShortDate(todayMax)})`;
    chipTodayMax.addEventListener('click', () => {
      fields.doj.value = BRTH.toIso(todayMax);
      onEdit();
    });
  }

  const chipTomorrow = $('chip-tomorrow');
  if (chipTomorrow) {
    chipTomorrow.textContent = `Tomorrow (${BRTH.toShortDate(tomorrow)})`;
    chipTomorrow.addEventListener('click', () => {
      fields.doj.value = BRTH.toIso(tomorrow);
      onEdit();
    });
  }

  const chipToday = $('chip-today');
  if (chipToday) {
    chipToday.textContent = `Today (${BRTH.toShortDate(today)})`;
    chipToday.addEventListener('click', () => {
      fields.doj.value = BRTH.toIso(today);
      onEdit();
    });
  }
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function addFallbackRow(selectedValue = '') {
  const list = $('fallback-list');
  const count = list.querySelectorAll('.fallback-row').length;
  const rankNum = count + 2; // Desired class is 1st priority, so fallbacks start at 2nd

  const row = document.createElement('div');
  row.className = 'fallback-row';

  const rankBadge = document.createElement('span');
  rankBadge.className = 'fallback-rank';
  rankBadge.textContent = `${rankNum}${getOrdinal(rankNum)}`;

  const select = document.createElement('select');
  select.className = 'fallback-select';
  select.setAttribute('aria-label', `Priority ${rankNum} fallback class`);
  select.append(new Option('Select fallback class…', ''));
  for (const [code, label] of BRTH.CLASSES) {
    select.append(new Option(`${code} - ${label}`, code));
  }
  if (selectedValue) select.value = selectedValue;

  select.addEventListener('change', () => {
    onEdit();
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'fallback-remove-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove this fallback';
  removeBtn.setAttribute('aria-label', `Remove priority ${rankNum} fallback choice`);
  removeBtn.addEventListener('click', () => {
    row.remove();
    updateFallbackRanks();
    onEdit();
  });

  row.append(rankBadge, select, removeBtn);
  list.append(row);
  updateFallbackEmptyState();
  return row;
}

function updateFallbackRanks() {
  const rows = document.querySelectorAll('#fallback-list .fallback-row');
  rows.forEach((row, idx) => {
    const rankNum = idx + 2;
    const badge = row.querySelector('.fallback-rank');
    if (badge) badge.textContent = `${rankNum}${getOrdinal(rankNum)}`;
    const sel = row.querySelector('.fallback-select');
    if (sel) sel.setAttribute('aria-label', `Priority ${rankNum} fallback class`);
    const btn = row.querySelector('.fallback-remove-btn');
    if (btn) btn.setAttribute('aria-label', `Remove priority ${rankNum} fallback choice`);
  });
  updateFallbackEmptyState();
}

function updateFallbackEmptyState() {
  const list = $('fallback-list');
  const hint = $('fallback-hint');
  const hasRows = list.querySelectorAll('.fallback-row').length > 0;
  const existingEmpty = list.querySelector('.fallback-empty');

  if (!hasRows) {
    if (!existingEmpty) {
      const empty = document.createElement('p');
      empty.className = 'fallback-empty';
      empty.textContent = 'No fallback class selected. Only 1st priority will be searched.';
      list.append(empty);
    }
    if (hint) hint.hidden = true;
  } else {
    if (existingEmpty) existingEmpty.remove();
    if (hint) hint.hidden = false;
  }
}

function getFallbackClasses() {
  return Array.from(document.querySelectorAll('.fallback-select'))
    .map((s) => s.value.trim().toUpperCase())
    .filter(Boolean);
}

async function onSchedule() {
  const trip = readTrip();
  const time = $('schedule-time').value;
  const autoNewest = $('auto-newest-date') ? $('auto-newest-date').checked : false;

  const baseProblems = [];
  if (!trip.from) baseProblems.push('Select a From station.');
  if (!trip.to) baseProblems.push('Select a To station.');
  if (trip.from && trip.to && trip.from.toLowerCase() === trip.to.toLowerCase()) {
    baseProblems.push('From and To must be different.');
  }
  if (!trip.cls) baseProblems.push('Choose a class.');

  if (!time) {
    $('schedule-status').textContent = 'Please enter a valid time (e.g. 08:00 AM).';
    $('schedule-status').classList.add('error');
    return;
  }

  // Calculate the target time for the alarm
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const isTomorrow = target.getDate() !== now.getDate();
  const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  let dojForSchedule = trip.doj;
  if (autoNewest) {
    // Dynamic date: 10 days ahead of the scheduled run date
    const autoDoj = BRTH.addDays(targetDateOnly, BRTH.BOOKING_WINDOW_DAYS);
    dojForSchedule = BRTH.toIso(autoDoj);
  } else {
    if (!trip.doj) {
      baseProblems.push('Pick a date of journey or check "Auto-target newest released date".');
    } else {
      const d = BRTH.fromIso(trip.doj);
      if (d < targetDateOnly) {
        baseProblems.push('Date of journey will already be in the past when the schedule runs.');
      } else {
        const windowAtRun = BRTH.bookingWindow(targetDateOnly);
        if (d > windowAtRun.max) {
          const rel = BRTH.releaseDateFor(trip.doj);
          baseProblems.push(`Date ${BRTH.toShortDate(d)} won't be released until ${BRTH.toShortDate(rel)} at 8 AM.`);
        }
      }
    }
  }

  if (baseProblems.length) {
    touched = true;
    $('errors').replaceChildren(...baseProblems.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
    $('schedule-status').textContent = 'Please fix the errors above before scheduling.';
    $('schedule-status').classList.add('error');
    return;
  }

  const tripToSave = { ...trip, doj: dojForSchedule };
  const path = BRTH.searchPath(tripToSave);

  await BRTH.save({
    trip: tripToSave,
    scheduleTargetTime: time,
    scheduleTargetTimestamp: target.getTime(),
    scheduledPath: path,
    autoNewestDate: autoNewest,
  });

  chrome.alarms.create('autoBookAlarm', { when: target.getTime() });

  const dayLabel = isTomorrow ? 'tomorrow' : 'today';
  const dojFormatted = BRTH.toSiteDate(dojForSchedule);
  const modeText = autoNewest ? `Auto-booking newest release: ${dojFormatted}` : `Target: ${dojFormatted}`;

  showScheduledState(time, target.getTime(), path, autoNewest, dojForSchedule);
  $('schedule-status').textContent = `Scheduled for ${time} ${dayLabel} (${modeText}). Leave your browser open!`;
  $('schedule-status').classList.remove('error');
}

async function onCancelSchedule() {
  await chrome.alarms.clear('autoBookAlarm');
  await chrome.storage.local.remove(['scheduleTargetTime', 'scheduleTargetTimestamp', 'scheduledPath', 'autoNewestDate']);
  showUnscheduledState();
  $('schedule-status').textContent = 'Schedule cancelled.';
  $('schedule-status').classList.remove('error');
}

function showScheduledState(time, timestamp, path, autoNewest, doj) {
  $('schedule-active-badge').hidden = false;
  $('cancel-schedule-btn').hidden = false;
  $('schedule-btn').textContent = 'Reschedule';
  if (time) $('schedule-time').value = time;
  if ($('auto-newest-date')) $('auto-newest-date').checked = !!autoNewest;

  const isTomorrow = timestamp && (new Date(timestamp).getDate() !== new Date().getDate());
  const dayLabel = isTomorrow ? 'tomorrow' : 'today';
  let detail = '';
  if (doj) {
    detail = autoNewest ? `Auto-booking release: ${BRTH.toSiteDate(doj)}` : `Journey: ${BRTH.toSiteDate(doj)}`;
  } else if (path) {
    const p = new URLSearchParams(path.split('?')[1] ?? '');
    detail = `Journey: ${p.get('doj') ?? ''}`;
  }
  $('schedule-status').textContent = `⏰ Active: Scheduled for ${time} ${dayLabel} (${detail}).`;
  $('schedule-status').classList.remove('error');
}

function showUnscheduledState() {
  $('schedule-active-badge').hidden = true;
  $('cancel-schedule-btn').hidden = true;
  $('schedule-btn').textContent = 'Schedule';
}

async function onSearch() {
  const trip = readTrip();
  if (problems(trip, true).length) return;
  const path = BRTH.searchPath(trip);
  // Lets the train list click BOOK NOW once for this search (if allowed in settings).
  await BRTH.save({ trip, bookArm: { path, at: Date.now() } });
  await openOnSite(path);
  window.close();
}

// Reuse the current tab if it is already on the railway site, otherwise open a new one.
async function openOnSite(path) {
  const url = BRTH.SITE + path;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.startsWith(BRTH.SITE)) {
    await chrome.tabs.update(tab.id, { url });
  } else {
    await chrome.tabs.create({ url });
  }
}

function readTrip() {
  const fallbackList = getFallbackClasses();
  return {
    from: fields.from.value.trim(),
    to: fields.to.value.trim(),
    doj: fields.doj.value,
    timePref: fields.timePref ? fields.timePref.value : 'any',
    cls: fields.cls.value,
    fallbackCls: fallbackList.join(', '),
    fallbackClsList: fallbackList,
    seats: Number(fields.seats.value),
    trains: fields.trains.value.trim(),
  };
}

function problems(trip, forSearchNow = true) {
  const list = [];
  if (!trip.from) list.push('Select a From station.');
  if (!trip.to) list.push('Select a To station.');
  if (trip.from && trip.to && trip.from.toLowerCase() === trip.to.toLowerCase()) {
    list.push('From and To must be different.');
  }
  if (!trip.doj) {
    list.push('Pick a date of journey.');
  } else {
    const d = BRTH.fromIso(trip.doj);
    const today = BRTH.today();
    if (d < today) {
      list.push('Date of journey cannot be in the past.');
    } else if (forSearchNow && !BRTH.isInWindow(trip.doj)) {
      const rel = BRTH.releaseDateFor(trip.doj);
      const isRelTomorrow = rel && BRTH.toIso(rel) === BRTH.toIso(BRTH.addDays(today, 1));
      const relWhen = isRelTomorrow ? 'tomorrow' : (rel ? `on ${BRTH.toShortDate(rel)}` : '');
      list.push(`Not released yet today (opens ${relWhen} at 8 AM). Use Schedule Auto-Start below!`);
    }
  }
  if (!trip.cls) list.push('Choose a desired class.');
  return list;
}

let saveStatusTimer = null;
async function onEdit() {
  touched = true;
  const trip = readTrip();
  render(trip);
  await BRTH.save({ trip });
  const statusEl = $('status');
  if (statusEl) {
    statusEl.textContent = '✓ Saved';
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => {
      statusEl.textContent = '';
    }, 2500);
  }
}

function render(trip = readTrip()) {
  const today = BRTH.today();
  const { min, max } = BRTH.bookingWindow(today);

  if (trip.doj) {
    const d = BRTH.fromIso(trip.doj);
    if (d < today) {
      $('doj-hint').textContent = `⚠️ Date is in the past (${BRTH.toShortDate(d)})`;
    } else if (BRTH.isInWindow(trip.doj)) {
      $('doj-hint').textContent = `Site format: ${BRTH.toSiteDate(trip.doj)} · Bookable now`;
    } else {
      const rel = BRTH.releaseDateFor(trip.doj);
      const isRelTomorrow = rel && BRTH.toIso(rel) === BRTH.toIso(BRTH.addDays(today, 1));
      const relText = isRelTomorrow ? 'tomorrow' : (rel ? `on ${BRTH.toShortDate(rel)}` : '');
      $('doj-hint').textContent = `Site format: ${BRTH.toSiteDate(trip.doj)} · Releases ${relText} at 8:00 AM`;
    }
  } else {
    $('doj-hint').textContent = `Bookable now: ${BRTH.toShortDate(min)} to ${BRTH.toShortDate(max)}`;
  }

  const list = problems(trip, true);
  $('search').disabled = list.length > 0;

  $('errors').replaceChildren(...(touched ? list : []).map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));

  const ready = list.length === 0;
  $('ready').hidden = !ready;
  if (ready) {
    const trains = BRTH.parseTrainPrefs(trip.trains);
    const fallbackList = getFallbackClasses();
    const hierarchy = [trip.cls, ...fallbackList].filter(Boolean).join(' → ');
    $('ready').textContent = `Ready: ${trip.from} → ${trip.to} · ${BRTH.toSiteDate(trip.doj)} · Class: ${hierarchy}` +
      ` · ${trip.seats} seat${trip.seats > 1 ? 's' : ''}` +
      (trains.length ? ` · prefers ${trip.trains}` : ' · any train');
  }
}

function setupStationDropdowns(searched = []) {
  const topStations = BRTH.TOP_STATIONS || [];
  const knownStations = BRTH.KNOWN_STATIONS || [];

  const extraStations = (searched || [])
    .map((s) => BRTH.canonicalStation(s))
    .filter((s) => s && !knownStations.includes(s));
  const allStations = [...new Set([...knownStations, ...extraStations])].sort((a, b) => a.localeCompare(b));

  for (const selectEl of [fields.from, fields.to]) {
    if (!selectEl) continue;
    const isFrom = selectEl === fields.from;
    const placeholderText = isFrom ? 'Select departure station…' : 'Select arrival station…';

    selectEl.replaceChildren();

    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.disabled = true;
    placeholderOpt.selected = true;
    placeholderOpt.textContent = placeholderText;
    selectEl.appendChild(placeholderOpt);

    // Group 1: Popular Hubs
    const popGroup = document.createElement('optgroup');
    popGroup.label = '★ Popular Hubs';
    for (const code of topStations) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = BRTH.stationLabel ? BRTH.stationLabel(code) : code;
      popGroup.appendChild(opt);
    }
    selectEl.appendChild(popGroup);

    // Group 2: All Stations A-Z
    const allGroup = document.createElement('optgroup');
    allGroup.label = 'All Stations (A – Z)';
    for (const code of allStations) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = BRTH.stationLabel ? BRTH.stationLabel(code) : code;
      allGroup.appendChild(opt);
    }
    selectEl.appendChild(allGroup);
  }
}

function ensureStationOption(selectEl, value) {
  if (!selectEl || !value) return;
  const exists = Array.from(selectEl.options).some((o) => o.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = BRTH.stationLabel ? BRTH.stationLabel(value) : value;
    selectEl.appendChild(opt);
  }
}

