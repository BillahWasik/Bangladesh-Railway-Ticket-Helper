// Parts 1d + 2a: on the train list, find the first preferred train with seats in the searched
// class, highlight its BOOK NOW button and scroll to it. If the user just clicked "Search trains"
// in the pop-up (and allows it in settings), click that BOOK NOW once. It never reloads the page,
// and a refresh or PREV/NEXT DAY never clicks BOOK NOW again.
(() => {
  const PATH = '/booking/train/search';
  const NO_TRAINS_TEXT = 'No train found';
  const SEAT_MAP_TEXT = 'Select Coach'; // shown inside the train card once its seat map opens
  const SETTLE_MS = 300;   // let Angular finish rendering before reading the list
  const MAX_WAIT_MS = 1500; // but don't wait forever if the page keeps changing
  const MAX_LINES = 6;
  const ARM_TTL_MS = 2 * 60 * 1000; // a Search click only counts for the page it opens
  const TOKEN_SETTLE_MS = 1200;     // same reason as on the login page
  const TOKEN_WAIT_MS = 30 * 1000;
  const SEAT_MAP_WAIT_MS = 10 * 1000;
  const MAX_COOLDOWN_S = 5 * 60;  // a longer wait than this the site asks for isn't worth waiting out
  const COOLDOWN_BUFFER_S = 2;

  const REFRESH_KEY = 'brth-refresh';
  const DEFAULT_REFRESH_S = 5;
  const DEFAULT_MAX_REFRESHES = 100;

  let refreshTimer = null;
  let refreshMessage = '';
  let lastHref = null;
  let lastSummary = null;
  let scrolledTo = null;
  let remembered = false;
  let armChecked = false;
  let autoBooking = false;
  let timer = null;
  let pendingSince = 0;
  let running = false;

  injectStyles();
  new MutationObserver(schedule)
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  // Preferred trains edited in the pop-up while this page is open.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.trip) {
      lastSummary = null;
      schedule();
    }
  });
  schedule();

  function schedule() {
    const now = Date.now();
    if (!timer) pendingSince = now;
    clearTimeout(timer);
    const wait = now - pendingSince > MAX_WAIT_MS ? 0 : SETTLE_MS;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, wait);
  }

  async function scan() {
    if (running) return schedule();
    running = true;
    try {
      await scanOnce();
    } finally {
      running = false;
    }
  }

  async function scanOnce() {
    // Single-page app: the URL changes on PREV/NEXT DAY and when leaving the list.
    if (location.pathname !== PATH) {
      if (lastHref) reset(true);
      return;
    }
    if (location.href !== lastHref) {
      reset(false);
      lastHref = location.href;
    }

    const query = readQuery();
    if (!query) return;

    // Right after PREV/NEXT DAY the old day's list can still be on screen.
    const shownDate = document.querySelector('.ticket-picker .date_time')?.textContent.trim();
    if (shownDate && shownDate.toLowerCase() !== query.doj.toLowerCase()) return;

    const trains = readTrains();
    const listText = trains.length ? '' : document.getElementById('search_list_sec')?.textContent ?? '';
    const noTrains = !trains.length && listText.includes(NO_TRAINS_TEXT);
    if (!trains.length && !noTrains) return; // list still loading

    // The pop-up's Search click is used up by the first finished list it opens, whatever is on it.
    let armed = false;
    if (!armChecked) {
      armChecked = true;
      armed = await takeArm(query);
    }

    if (noTrains) {
      clearHighlight();
      render(`${heading(query)}\nNo trains found. Check the station spelling, or try another date.`, 'warn');
      return;
    }

    if (!remembered) {
      remembered = true;
      await rememberStations(query.from, query.to);
    }

    const { trip, settings } = await BRTH.load(['trip', 'settings']);
    const validTrains = trains.filter(t => matchesTimePref(t, trip?.timePref));
    const prefs = BRTH.parseTrainPrefs(trip?.trains);
    const { candidates, unmatched } = orderByPreference(validTrains, prefs);

    const fallbackClsList = trip?.fallbackClsList ||
      (trip?.fallbackCls ? trip.fallbackCls.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean) : []);
    const targetClasses = [query.cls, ...fallbackClsList].map(c => c.trim().toUpperCase());
    
    // Evaluate hierarchy in strict priority order:
    // First try desired class (1st priority) across candidate trains;
    // If not found, try 2nd priority across candidate trains, then 3rd, etc.
    let pick = null;
    let pickedClassName = query.cls;
    let pickedPriority = 1;

    for (let i = 0; i < targetClasses.length; i++) {
      const cName = targetClasses[i];
      for (const train of candidates) {
        const cls = train.classes.find((c) => c.name === cName);
        if (cls && cls.seats > 0 && cls.bookBtn) {
          pick = { train, cls };
          pickedClassName = cName;
          pickedPriority = i + 1;
          break;
        }
      }
      if (pick) break;
    }
    
    const withClass = (train) => ({ train, cls: train.classes.find((c) => c.name === query.cls) });
    const options = candidates.map(withClass);

    if (armed) {
      if (pick) {
        autoBooking = true;
        autoBook(pick); // runs on its own; reports under the "booking" panel line
      } else if (settings?.autoRefresh) {
        // Keep the one-shot permission alive across the refresh so the retry that finds seats can book.
        await chrome.storage.local.set({ bookArm: { path: location.pathname + location.search, at: Date.now() } });
      } else {
        note("Didn't click BOOK NOW: no seats to book on this list.", 'warn');
      }
    }

    clearHighlight();
    const lines = [heading(query)];

    if (pick) {
      pick.cls.box.classList.add('brth-pick');
      const key = `${location.href}|${pick.train.title}`;
      if (scrolledTo !== key) {
        scrolledTo = key;
        pick.cls.box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const priorityLabel = pickedPriority > 1 ? ` (Priority #${pickedPriority} fallback)` : '';
      lines.push(`✔ ${pick.train.title} · ${pick.train.departs}`,
        `${pick.cls.seats} ${pickedClassName} seat(s)${priorityLabel} · ${pick.cls.fare}`,
        autoBooking ? 'BOOK NOW is highlighted.' : 'BOOK NOW is highlighted. Click it yourself.');
    } else if (prefs.length && !candidates.length) {
      lines.push('None of your preferred trains are on this list.');
    } else {
      const searchedClasses = targetClasses.length > 1 ? targetClasses.join('/') : query.cls;
      lines.push(`No ${searchedClasses} seats on ${prefs.length ? 'your preferred trains' : 'any train'} right now.`);
    }

    // With no preferred train on the list, show every train so you can choose.
    const others = pick ? options.filter((o) => o !== pick)
      : options.length ? options
      : trains.map(withClass);
    if (others.length) {
      lines.push('', pick ? 'Others:' : 'Seats now:');
      for (const o of others.slice(0, MAX_LINES)) lines.push(describe(o, query.cls));
    }
    if (prefs.length && unmatched.length) lines.push('', `Not running on this date: ${unmatched.join(', ')}`);
    
    if (pick) {
      clearRefreshCount();
    } else {
      if (settings?.autoRefresh) {
        lines.push('', scheduleRefresh(settings));
      } else if (candidates.length) {
        lines.push('', 'Refresh the page yourself to check again.');
      }
    }

    render(lines.join('\n'), pick ? 'info' : 'warn');
  }

  // Reload the list after the user's interval (+/-20% so retries don't line up with everyone
  // else's), up to their cap. The count lives in sessionStorage so it survives the reload.
  function scheduleRefresh(settings) {
    if (refreshTimer) return refreshMessage; // already counting down; scans fire on every page update
    const base = Math.max(2, Number(settings.refreshSecs) || DEFAULT_REFRESH_S);
    const cap = Math.max(0, Number(settings.maxRefreshes ?? DEFAULT_MAX_REFRESHES)); // 0 = no cap
    const state = readRefreshCount();
    if (cap && state.n >= cap) {
      return `Stopped auto-refreshing after ${cap} tries. Refresh the page to keep trying.`;
    }
    const secs = Math.max(2, Math.round(base * (0.8 + Math.random() * 0.4)));
    const attempt = state.n + 1;
    refreshTimer = setTimeout(() => {
      try { sessionStorage.setItem(REFRESH_KEY, JSON.stringify({ href: location.href, n: attempt })); } catch { /* private mode */ }
      location.reload();
    }, secs * 1000);
    refreshMessage = `Try ${attempt}${cap ? ` of ${cap}` : ''}: refreshing in ~${secs}s…`;
    return refreshMessage;
  }

  function readRefreshCount() {
    try {
      const s = JSON.parse(sessionStorage.getItem(REFRESH_KEY) ?? 'null');
      if (s?.href === location.href) return s;
    } catch { /* ignore */ }
    return { n: 0 };
  }

  function clearRefreshCount() {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    try { sessionStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
  }

  function readQuery() {
    const p = new URLSearchParams(location.search);
    const q = { from: p.get('fromcity'), to: p.get('tocity'), doj: p.get('doj'), cls: p.get('class') };
    return q.from && q.to && q.doj && q.cls ? q : null;
  }

  function readTrains() {
    return [...document.querySelectorAll('app-single-trip')].map((el) => {
      const title = el.querySelector('.trip-name h2')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
      const m = title.match(/^(.*?)\s*\((\d+)\)$/); // "RANGPUR EXPRESS (771)"
      return {
        el,
        title,
        name: (m ? m[1] : title).toLowerCase(),
        number: m ? m[2] : '',
        departs: el.querySelector('.journey-start .journey-date')?.textContent.trim() ?? '',
        classes: [...el.querySelectorAll('.single-seat-class')].map((box) => ({
          box,
          name: box.querySelector('.seat-class-name')?.textContent.trim() ?? '',
          fare: box.querySelector('.seat-class-fare')?.textContent.trim() ?? '',
          seats: parseInt(box.querySelector('.all-seats')?.textContent ?? '', 10) || 0,
          bookBtn: box.querySelector('.book-now-btn'),
        })),
      };
    }).filter((t) => t.title);
  }

  // No preferences: every train in page order. Otherwise only matching trains, best preference first.
  function orderByPreference(trains, prefs) {
    if (!prefs.length) return { candidates: trains, unmatched: [] };
    const candidates = [];
    const unmatched = [];
    for (const pref of prefs) {
      const hits = trains.filter((t) => t.number === pref || t.name.includes(pref));
      if (!hits.length) unmatched.push(pref);
      for (const t of hits) if (!candidates.includes(t)) candidates.push(t);
    }
    return { candidates, unmatched };
  }

  function describe({ train, cls }, wanted) {
    if (!cls) return `${train.title}: no ${wanted}`;
    let text = `${train.title}: ${cls.seats} ${wanted}`;
    if (cls.seats === 0) {
      const elsewhere = train.classes.filter((c) => c.seats > 0).map((c) => `${c.name} ${c.seats}`);
      if (elsewhere.length) text += ` (has ${elsewhere.join(', ')})`;
    }
    return text;
  }

  function heading(q) {
    return `${q.from} → ${q.to} · ${q.doj} · ${q.cls}`;
  }

  // Stations that returned trains are spelled the way the site wants; offer them in the pop-up.
  async function rememberStations(...names) {
    const { stations = [] } = await BRTH.load('stations');
    await BRTH.save({ stations: [...new Set([...names, ...stations])].slice(0, 30) });
  }

  function render(text, tone) {
    // While a seat map is open, the seat panel (content/seatmap.js) says what matters.
    if (document.querySelector('app-seat-layout')) {
      if (lastSummary) BRTHBadge.hide('results');
      lastSummary = null;
      return;
    }
    if (text === lastSummary) return; // closing the panel keeps it closed until something changes
    lastSummary = text;
    BRTHBadge.show(text, tone, 0, 'results');
  }

  function clearHighlight() {
    document.querySelectorAll('.brth-pick').forEach((el) => el.classList.remove('brth-pick'));
  }

  function reset(leftPage) {
    if (leftPage && lastSummary) BRTHBadge.hide('results');
    if (lastHref) BRTHBadge.hide('booking');
    clearTimeout(refreshTimer); // a pending reload belongs to the list we're leaving
    refreshTimer = null;
    clearHighlight();
    lastHref = null;
    lastSummary = null;
    scrolledTo = null;
    remembered = false;
    armChecked = false;
    autoBooking = false;
  }

  // --- 2a: one automatic BOOK NOW click per "Search trains" click in the pop-up ---

  // True if the pop-up armed this exact search moments ago and auto BOOK NOW is allowed.
  // A matching or stale arm is removed, so it can never fire twice.
  async function takeArm(query) {
    const { bookArm, settings } = await BRTH.load(['bookArm', 'settings']);
    if (!bookArm) return false;
    const fresh = Date.now() - bookArm.at < ARM_TTL_MS;
    const same = sameSearch(bookArm.path, query);
    if (same || !fresh) await chrome.storage.local.remove('bookArm');
    return same && fresh && settings?.autoBookNow !== false;
  }

  function sameSearch(path, q) {
    const p = new URLSearchParams(path.split('?')[1] ?? '');
    return p.get('fromcity') === q.from && p.get('tocity') === q.to &&
      (p.get('doj') ?? '').toLowerCase() === q.doj.toLowerCase() && p.get('class') === q.cls;
  }

  async function autoBook(pick) {
    const label = `${pick.train.title} · ${pick.cls.name}`;
    const startHref = location.href;
    note(`Clicking BOOK NOW on ${label} once the page's Cloudflare check is ready…`);

    // A second attempt happens only when the site itself says how long to wait
    // ("Multiple order attempt detected. Please try after 0 minute 17 seconds.").
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!(await waitForPageToken())) {
        note("This page's Cloudflare check didn't finish. Click BOOK NOW yourself.", 'warn');
        return;
      }
      // Angular may have re-rendered the list while we waited, so look the button up again.
      const train = readTrains().find((t) => t.title === pick.train.title);
      const button = train?.classes.find((c) => c.name === pick.cls.name)?.bookBtn;
      if (!button || button.disabled) {
        note('BOOK NOW is no longer available on this train. Search again.', 'warn');
        return;
      }
      if (attempt > 1 && train.el.querySelector('app-seat-layout')) {
        note('The seat map is already open, so no retry was needed.', 'info', 5000);
        return;
      }
      // Lets seatmap.js select seats on the seat map this click opens (and only that one).
      BRTHFlow.seatPick = { train: pick.train.title, cls: pick.cls.name, at: Date.now() };
      button.click();
      note(`Clicked BOOK NOW on ${label}…`);

      const result = await waitForSeatMap(train.el);
      if (result.open) {
        note(`Clicked BOOK NOW on ${label}. Seat map is open.`, 'info', 5000);
        return;
      }
      BRTHFlow.seatPick = null;
      if (!result.alert) {
        note(`Clicked BOOK NOW on ${label}, but no seat map appeared yet. Check the page.`, 'warn');
        return;
      }

      const wait = BRTH.cooldownSeconds(result.alert);
      if (wait === null || wait > MAX_COOLDOWN_S || attempt > 1) {
        note(`${attempt > 1 ? 'Tried once more, but the' : 'The'} site says: "${result.alert}"` +
          (wait !== null ? ' Stopped; try BOOK NOW yourself later.' : ''), 'warn');
        return;
      }
      BRTH.dismissSiteAlert();
      const stillHere = await BRTH.countdown(wait + COOLDOWN_BUFFER_S,
        (left) => note(`The site says: "${result.alert}"\nTrying BOOK NOW once more in ${left} s…`, 'warn'),
        () => location.href === startHref);
      if (!stillHere) {
        note('Retry cancelled because you left this train list.', 'warn', 5000);
        return;
      }
    }
  }

  // The train list carries an invisible Cloudflare check too. Wait until its token exists and
  // has stopped changing. No token input on the page means there is nothing to wait for.
  async function waitForPageToken() {
    const started = Date.now();
    let stable;
    let stableSince = 0;
    while (Date.now() - started < TOKEN_WAIT_MS) {
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      if (!input) return true;
      if (input.value) {
        if (input.value !== stable) {
          stable = input.value;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= TOKEN_SETTLE_MS) {
          return true;
        }
      } else {
        stable = undefined;
      }
      await sleep(250);
    }
    return false;
  }

  async function waitForSeatMap(trainEl) {
    const started = Date.now();
    while (Date.now() - started < SEAT_MAP_WAIT_MS) {
      await sleep(250);
      if (trainEl.isConnected && trainEl.textContent.includes(SEAT_MAP_TEXT)) return { open: true };
      const alert = BRTH.siteAlertText();
      if (alert) return { alert };
    }
    return {};
  }

  function note(message, tone = 'info', hideAfterMs = 0) {
    BRTHBadge.show(message, tone, hideAfterMs, 'booking');
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .brth-pick { outline: 3px solid #d97706 !important; outline-offset: 2px; border-radius: 6px; }
      .brth-pick .book-now-btn { box-shadow: 0 0 0 3px #d97706, 0 0 14px 3px rgba(217, 119, 6, 0.6) !important; }
    `;
    document.head.append(style);
  }

  function matchesTimePref(train, pref) {
    if (!pref || pref === 'any') return true;
    const m = (train.departs || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return true;
    
    let hours = parseInt(m[1], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    if (pref === 'morning') return hours >= 6 && hours < 12;
    if (pref === 'afternoon') return hours >= 12 && hours < 18;
    if (pref === 'evening') return hours >= 18 && hours < 24;
    if (pref === 'night') return hours >= 0 && hours < 6;
    return true;
  }
})();
