// Constants and helpers shared by the popup, the options page and the content scripts.

// Hand-offs between content scripts on the same page (they share this global scope).
// seatPick: set by results.js just before its automatic BOOK NOW click, so seatmap.js may
// select seats on the seat map that click opens: { train, cls, at }.
const BRTHFlow = { seatPick: null };

const BRTH = (() => {
  const SITE = 'https://eticket.railway.gov.bd';

  // Class codes exactly as the site's "Choose Class" dropdown sends them.
  const CLASSES = [
    ['AC_B', 'AC Berth'],
    ['AC_S', 'AC Seat'],
    ['SNIGDHA', 'Snigdha (AC chair)'],
    ['F_BERTH', 'First Class Berth'],
    ['F_SEAT', 'First Class Seat'],
    ['F_CHAIR', 'First Class Chair'],
    ['S_CHAIR', 'Shovan Chair'],
    ['SHOVAN', 'Shovan (flat bench)'],
    ['SHULOV', 'Shulov (wooden bench)'],
    ['AC_CHAIR', 'AC Chair'],
  ];

  // Most frequent / top intercity route hubs for Bangladesh Railway
  const TOP_STATIONS = [
    'Dhaka',
    'Biman_Bandar',
    'Chattogram',
    "Cox's Bazar",
    'Sylhet',
    'Rajshahi',
    'Khulna',
    'Rangpur',
    'Bogura',
    'Cumilla',
    'Dinajpur',
    'Mymensingh',
    'Panchagarh',
    'Benapole',
    'Sreemangal',
    'Dhaka_Cantonment',
    'Feni',
    'Brahmanbaria',
    'Joydebpur',
    'Santahar',
    'Ishwardi',
    'Chandpur',
    'Noakhali',
    'Jamalpur_Town',
    'Tangail',
    'Chapainawabganj',
    'Kishoreganj',
    'Chilahati',
    'Bhairab_Bazar',
    'Akhaura',
  ];

  // Comprehensive verified list of Bangladesh Railway stations.
  // Spellings confirmed from official e-ticketing platform (exact URL parameter requirements).
  const KNOWN_STATIONS = [
    'Abdulpur',
    'Aditmari',
    'Ahsanganj',
    'Akhanagar',
    'Akhaura',
    'Akkelpur',
    'Alamdanga',
    'Amirabad',
    'Amnura',
    'Amnura_Bypass',
    'Arani',
    'Ashuganj',
    'Atharabari',
    'Azampur',
    'Azim Nagar',
    'Badarganj',
    'Badherhat',
    'Badiakhali',
    'Baharpur',
    'Bajitpur',
    'Bajra',
    'Bamondanga',
    'Banani',
    'Baramchal',
    'Barhatta',
    'Barkhata',
    'Baura',
    'Benapole',
    'Bhairab_Bazar',
    'Bhanga',
    'Bhanga_Junction',
    'Bhanugach',
    'Bhatiary',
    'Bheramara',
    'Bhomradah',
    'Bhotmari',
    'Bhuapur',
    'Bidyaganj',
    'Biman_Bandar',
    'Birampur',
    'Birol',
    'Boalmari_Bazar',
    'Bogura',
    'Bolakhal',
    'Bonar_Para',
    'Boral_Bridge',
    'Borashi',
    'Brahmanbaria',
    'Burimari',
    'Chakaria',
    'Chandpur',
    'Chandpur_Court',
    'Chandradighalia',
    'Chapainawabganj',
    'Chapta',
    'Chatmohar',
    'Chattogram',
    'Chilahati',
    'Chirirbandar',
    'Chitoshi_Road',
    'Choto Bahirbag',
    'Choumuhani',
    'Chuadanga',
    'Chulkati_Bazar',
    "Cox's Bazar",
    'Cumilla',
    'Darshana_Halt',
    'Dhaka',
    'Dhaka_Cantonment',
    'Dinajpur',
    'Dohazari',
    'Faridpur',
    'Feni',
    'Fulbari',
    'Gaibandha',
    'Gafargaon',
    'Gobindaganj',
    'Gopalganj',
    'Hasanpur',
    'Hili',
    'Ishwardi',
    'Ishwardi_Bypass',
    'Jamalpur_Town',
    'Jamtail',
    'Jashore',
    'Jhenaidah',
    'Joydebpur',
    'Joypurhat',
    'Kashiani',
    'Kaunia',
    'Khilgaon',
    'Khulna',
    'Kishoreganj',
    'Kulaura',
    'Kurigram',
    'Kushtia_Court',
    'Laksam',
    'Lalmonirhat',
    'Lohagara',
    'Maijdee_Court',
    'Malandaha_Bazar',
    'Mirpur',
    'Mirzapur',
    'Mohanganj',
    'Mubarakganj',
    'Mymensingh',
    'Narsingdi',
    'Natore',
    'Netrokona',
    'Nilphamari',
    'Noakhali',
    'Pabna',
    'Panchagarh',
    'Parbatipur',
    'Pirgachha',
    'Poradaha',
    'Rajbari',
    'Rajshahi',
    'Rangpur',
    'Rohanpur',
    'Saidpur',
    'Santahar',
    'Sararchar',
    'Setabganj',
    'Shahjadpur',
    'Shayestaganj',
    'Sirajganj_Bazar',
    'Sonaimuri',
    'Sreemangal',
    'Sylhet',
    'Tangail',
    'Taraganj',
    'Tarakandi',
    'Teesta',
    'Thakurgaon_Road',
    'Tongi_Junction',
    'Ullapara',
  ];

  const STATION_LABELS = {
    'Dhaka': 'Dhaka (Kamalapur)',
    'Biman_Bandar': 'Biman Bandar (Airport)',
    'Dhaka_Cantonment': 'Dhaka Cantonment',
    'Chattogram': 'Chattogram (Chittagong)',
    "Cox's Bazar": "Cox's Bazar",
    'Sylhet': 'Sylhet',
    'Rajshahi': 'Rajshahi',
    'Khulna': 'Khulna',
    'Rangpur': 'Rangpur',
    'Bogura': 'Bogura (Bogra)',
    'Cumilla': 'Cumilla (Comilla)',
    'Dinajpur': 'Dinajpur',
    'Mymensingh': 'Mymensingh',
    'Panchagarh': 'Panchagarh',
    'Benapole': 'Benapole',
    'Sreemangal': 'Sreemangal',
    'Feni': 'Feni',
    'Brahmanbaria': 'Brahmanbaria',
    'Joydebpur': 'Joydebpur',
    'Santahar': 'Santahar',
    'Ishwardi': 'Ishwardi',
    'Chandpur': 'Chandpur',
    'Noakhali': 'Noakhali',
    'Jamalpur_Town': 'Jamalpur Town',
    'Tangail': 'Tangail',
    'Chapainawabganj': 'Chapainawabganj',
    'Kishoreganj': 'Kishoreganj',
    'Chilahati': 'Chilahati',
    'Bhairab_Bazar': 'Bhairab Bazar',
    'Akhaura': 'Akhaura',
    'Jashore': 'Jashore (Jessore)',
    'Tongi_Junction': 'Tongi Junction',
    'Bhanga_Junction': 'Bhanga Junction',
    'Chandpur_Court': 'Chandpur Court',
    'Kushtia_Court': 'Kushtia Court',
    'Maijdee_Court': 'Maijdee Court',
    'Darshana_Halt': 'Darshana Halt',
    'Ishwardi_Bypass': 'Ishwardi Bypass',
    'Amnura_Bypass': 'Amnura Bypass',
    'Boalmari_Bazar': 'Boalmari Bazar',
    'Chulkati_Bazar': 'Chulkati Bazar',
    'Sirajganj_Bazar': 'Sirajganj Bazar',
    'Malandaha_Bazar': 'Malandaha Bazar',
    'Thakurgaon_Road': 'Thakurgaon Road',
    'Chitoshi_Road': 'Chitoshi Road',
    'Bonar_Para': 'Bonar Para',
    'Boral_Bridge': 'Boral Bridge',
  };

  const STATION_ALIASES = {
    'dhaka cantonment': 'Dhaka_Cantonment',
    'dhaka_cantonment': 'Dhaka_Cantonment',
    'biman bandar': 'Biman_Bandar',
    'biman_bandar': 'Biman_Bandar',
    'dhaka airport': 'Biman_Bandar',
    'airport': 'Biman_Bandar',
    'chittagong': 'Chattogram',
    'chattogram': 'Chattogram',
    'ctg': 'Chattogram',
    'comilla': 'Cumilla',
    'cumilla': 'Cumilla',
    'bogra': 'Bogura',
    'bogura': 'Bogura',
    'jessore': 'Jashore',
    'jashore': 'Jashore',
    'coxs bazar': "Cox's Bazar",
    'cox bazar': "Cox's Bazar",
    "cox's bazar": "Cox's Bazar",
    'jamalpur': 'Jamalpur_Town',
    'jamalpur town': 'Jamalpur_Town',
    'jamalpur_town': 'Jamalpur_Town',
    'bhairab': 'Bhairab_Bazar',
    'bhairab bazar': 'Bhairab_Bazar',
    'bhairab_bazar': 'Bhairab_Bazar',
    'ishwardi bypass': 'Ishwardi_Bypass',
    'ishwardi_bypass': 'Ishwardi_Bypass',
    'tongi': 'Tongi_Junction',
    'tongi junction': 'Tongi_Junction',
    'tongi_junction': 'Tongi_Junction',
    'bhanga junction': 'Bhanga_Junction',
    'bhanga_junction': 'Bhanga_Junction',
    'darshana': 'Darshana_Halt',
    'darshana halt': 'Darshana_Halt',
    'darshana_halt': 'Darshana_Halt',
    'chandpur court': 'Chandpur_Court',
    'chandpur_court': 'Chandpur_Court',
    'kushtia court': 'Kushtia_Court',
    'kushtia_court': 'Kushtia_Court',
    'maijdee court': 'Maijdee_Court',
    'maijdee_court': 'Maijdee_Court',
  };

  function stationLabel(code) {
    if (!code) return '';
    if (STATION_LABELS[code]) return STATION_LABELS[code];
    return code.replace(/_/g, ' ');
  }

  function canonicalStation(name) {
    if (!name) return '';
    const trimmed = String(name).trim();
    const lower = trimmed.toLowerCase();
    if (STATION_ALIASES[lower]) return STATION_ALIASES[lower];
    const match = KNOWN_STATIONS.find((s) => s.toLowerCase() === lower);
    if (match) return match;
    const withUnder = trimmed.replace(/\s+/g, '_');
    const matchUnder = KNOWN_STATIONS.find((s) => s.toLowerCase() === withUnder.toLowerCase());
    if (matchUnder) return matchUnder;
    return trimmed;
  }

  // The site sells tickets from today up to 10 days ahead.
  const BOOKING_WINDOW_DAYS = 10;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Local-date ISO string, as used by <input type="date">.
  function toIso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, days) {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res;
  }

  function bookingWindow(baseDate = today()) {
    const min = new Date(baseDate);
    min.setHours(0, 0, 0, 0);
    const max = addDays(min, BOOKING_WINDOW_DAYS);
    return { min, max };
  }

  function isInWindow(iso, baseDate = today()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const d = fromIso(iso);
    const { min, max } = bookingWindow(baseDate);
    return d >= min && d <= max;
  }

  // Returns the date when tickets for this journey date are released (10 days prior)
  function releaseDateFor(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    return addDays(fromIso(iso), -BOOKING_WINDOW_DAYS);
  }

  // Tomorrow morning at 8:00 AM, tickets for today + 11 days (tomorrow + 10 days) are released
  function tomorrowReleaseDate() {
    return addDays(today(), BOOKING_WINDOW_DAYS + 1);
  }

  // Furthest date bookable right now today
  function todayMaxDate() {
    return addDays(today(), BOOKING_WINDOW_DAYS);
  }

  // "2026-10-10" -> "10-Oct-2026", the format the site's search URL uses.
  function toSiteDate(iso) {
    const d = fromIso(iso);
    return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  }

  function toShortDate(d) {
    return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`;
  }

  // Matches the site's own encoding, e.g. "Cox's Bazar" -> "Cox%27s%20Bazar".
  const encodeParam = (s) => encodeURIComponent(s).replace(/'/g, '%27');

  // Path of the site's train list for a trip, e.g.
  // /booking/train/search?fromcity=Dhaka&tocity=Cox%27s%20Bazar&doj=10-Oct-2026&class=S_CHAIR
  function searchPath(trip) {
    return '/booking/train/search' +
      `?fromcity=${encodeParam(trip.from)}` +
      `&tocity=${encodeParam(trip.to)}` +
      `&doj=${toSiteDate(trip.doj)}` +
      `&class=${encodeParam(trip.cls)}`;
  }

  // "Rangpur Express, 771" -> ['rangpur express', '771'], kept in preference order.
  function parseTrainPrefs(text) {
    return (text ?? '').split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  // The user's seat rules, with defaults: 1 seat, window, together, any coach.
  function seatRules(trip, settings) {
    const count = Number(trip?.seats) || 1;
    return {
      count: Math.min(4, Math.max(1, count)),
      position: settings?.seatPosition ?? 'window', // 'window' | 'aisle' | 'any'
      together: settings?.seatsTogether ?? true,
      coaches: parseTrainPrefs(settings?.preferredCoaches), // same "a, b" format, lower-cased
      splitCoaches: settings?.splitCoaches ?? true,
    };
  }

  // Text of the SweetAlert2 pop-up the site uses for its errors, or '' if none is open.
  function siteAlertText() {
    const popup = document.querySelector('.swal2-container .swal2-popup');
    if (!popup) return '';
    const parts = ['.swal2-title', '.swal2-html-container']
      .map((sel) => popup.querySelector(sel)?.textContent.trim())
      .filter(Boolean);
    return parts.join(' ') || popup.textContent.trim();
  }

  // The wait the site asks for, in seconds, or null if the text isn't such a request, e.g.
  // "Multiple order attempt detected. Please try after 0 minute 17 seconds." -> 17
  function cooldownSeconds(text) {
    const m = /try\s+(?:again\s+)?after\s+(?:(\d+)\s*min\w*)?[\s,and]*(?:(\d+)\s*sec\w*)?/i.exec(text ?? '');
    if (!m || (m[1] === undefined && m[2] === undefined)) return null;
    return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  }

  // Close the site's error pop-up the way a user would (its OKAY button).
  function dismissSiteAlert() {
    document.querySelector('.swal2-container .swal2-confirm')?.click();
  }

  // Counts down once a second, calling onTick(secondsLeft). Resolves false as soon as
  // keepGoing() turns false (e.g. the user left the page), true when the time is up.
  async function countdown(seconds, onTick, keepGoing = () => true) {
    for (let left = seconds; left > 0; left--) {
      if (!keepGoing()) return false;
      onTick(left);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return keepGoing();
  }

  const load = (keys) => chrome.storage.local.get(keys);
  const save = (items) => chrome.storage.local.set(items);

  function initTheme(toggleBtn) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['theme'], (res) => {
        if (res?.theme === 'dark' || res?.theme === 'light') {
          document.documentElement.setAttribute('data-theme', res.theme);
        }
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        const current = document.documentElement.getAttribute('data-theme');
        const isDark = current === 'dark' || (!current && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const next = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ theme: next });
        }
      });
    }
  }

  return { SITE, CLASSES, KNOWN_STATIONS, TOP_STATIONS, STATION_LABELS, stationLabel, canonicalStation, BOOKING_WINDOW_DAYS, today, toIso, fromIso, addDays, bookingWindow, isInWindow, releaseDateFor, tomorrowReleaseDate, todayMaxDate, toSiteDate, toShortDate, searchPath, parseTrainPrefs, seatRules, siteAlertText, cooldownSeconds, dismissSiteAlert, countdown, load, save, initTheme };
})();
