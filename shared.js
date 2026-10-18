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
    const previewMode = Boolean(trip?.previewMode ?? settings?.previewMode ?? false);
    return {
      count: Math.min(4, Math.max(1, count)),
      position: settings?.seatPosition ?? 'window', // 'window' | 'aisle' | 'any'
      together: settings?.seatsTogether ?? true,
      coaches: parseTrainPrefs(settings?.preferredCoaches), // same "a, b" format, lower-cased
      splitCoaches: settings?.splitCoaches ?? true,
      avoidLavatory: settings?.avoidLavatory ?? true,
      previewMode,
      autoContinuePurchase: previewMode ? false : (trip?.autoContinuePurchase ?? settings?.autoContinuePurchase ?? true),
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

  // Intercity stations belonging to the Eastern Zone (release daily at 2:00 PM / 14:00)
  // All other routes belong to the Western Zone (release daily at 8:00 AM / 08:00)
  const EASTERN_STATIONS = [
    'chattogram', "cox's bazar", 'sylhet', 'sreemangal', 'cumilla', 'feni', 'brahmanbaria',
    'noakhali', 'chandpur', 'bhairab_bazar', 'akhaura', 'mymensingh', 'jamalpur_town',
    'kishoreganj', 'netrokona', 'mohanganj', 'tarakandi', 'sarishabari', 'dewanganj_bazar',
    'bajitpur', 'kulaura', 'shamshernagar', 'maizgaon', 'comilla', 'gunabati',
    'feni_junction', 'sitakundu', 'pahartali', 'dohazari', 'harbang', 'chakaria', 'ramu',
    'ashuganj', 'baramchal', 'bhanugach', 'chhatak_bazar', 'laksham', 'laksam',
    'maiidee_court', 'maijdi_court', 'shorishabari', 'bb_east'
  ];

  function detectRouteZone(fromStation, toStation) {
    const f = (fromStation || '').toLowerCase().replace(/\s+/g, '_');
    const t = (toStation || '').toLowerCase().replace(/\s+/g, '_');
    
    // Check if either destination or origin is an Eastern Zone hub
    const isEastern = EASTERN_STATIONS.some((s) => f.includes(s) || t.includes(s));
    
    if (isEastern) {
      return {
        zone: 'eastern',
        time: '14:00',
        name: 'Eastern Zone',
        dropTimeStr: '2:00 PM (14:00)',
        badge: '☀️ Eastern Zone (2:00 PM Drop)',
      };
    }
    return {
      zone: 'western',
      time: '08:00',
      name: 'Western Zone',
      dropTimeStr: '8:00 AM (08:00)',
      badge: '🌅 Western Zone (8:00 AM Drop)',
    };
  }

  // Web Audio chime generator for seat availability, OTP arrival, and alerts
  function playChime(type = 'seatFound') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'seatFound') {
        // High upbeat 4-note ascending chime: C5 (523), E5 (659), G5 (784), C6 (1046)
        const notes = [523.25, 659.25, 784.00, 1046.50];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.11);
          gain.gain.setValueAtTime(0.22, ctx.currentTime + i * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.35);
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.11);
          osc.stop(ctx.currentTime + i * 0.11 + 0.35);
        });
        setTimeout(() => ctx.close(), notes.length * 110 + 400);
      } else if (type === 'otp') {
        // Attention double-ding: E5 (659Hz) and B5 (987Hz)
        const notes = [659.25, 987.77];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
          gain.gain.setValueAtTime(0.28, ctx.currentTime + i * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.38);
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.14);
          osc.stop(ctx.currentTime + i * 0.14 + 0.38);
        });
        setTimeout(() => ctx.close(), 700);
      } else {
        // Simple alert beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
        setTimeout(() => ctx.close(), 300);
      }
    } catch { /* AudioContext restricted before gesture */ }
  }

  // Official Weekly Off-Days for Bangladesh Railway intercity trains
  // day: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const TRAIN_OFF_DAYS = {
    'suborno': { day: 1, name: 'Monday' },
    'suborno express': { day: 1, name: 'Monday' },
    'sonar bangla': { day: 3, name: 'Wednesday' },
    'sonar bangla express': { day: 3, name: 'Wednesday' },
    'cox\'s bazar': { day: 1, name: 'Monday' },
    'cox\'s bazar express': { day: 1, name: 'Monday' },
    'tourist': { day: 0, name: 'Sunday' },
    'tourist express': { day: 0, name: 'Sunday' },
    'parabat': { day: 2, name: 'Tuesday' },
    'parabat express': { day: 2, name: 'Tuesday' },
    'padma': { day: 2, name: 'Tuesday' },
    'padma express': { day: 2, name: 'Tuesday' },
    'silkcity': { day: 0, name: 'Sunday' },
    'silkcity express': { day: 0, name: 'Sunday' },
    'dhumketu': { day: 4, name: 'Thursday' },
    'dhumketu express': { day: 4, name: 'Thursday' },
    'bonolota': { day: 5, name: 'Friday' },
    'bonolota express': { day: 5, name: 'Friday' },
    'kalni': { day: 5, name: 'Friday' },
    'kalni express': { day: 5, name: 'Friday' },
    'jayantik': { day: 2, name: 'Tuesday' },
    'jayantik express': { day: 2, name: 'Tuesday' },
    'upaban': { day: 3, name: 'Wednesday' },
    'upaban express': { day: 3, name: 'Wednesday' },
    'mohonogor provati': { day: 0, name: 'Sunday' },
    'mohonogor godhuli': { day: 1, name: 'Monday' },
    'mohonogor express': { day: 0, name: 'Sunday' },
    'chattala': { day: 5, name: 'Friday' },
    'chattala express': { day: 5, name: 'Friday' },
    'bijoy': { day: 3, name: 'Wednesday' },
    'bijoy express': { day: 3, name: 'Wednesday' },
    'paharika': { day: 1, name: 'Monday' },
    'paharika express': { day: 1, name: 'Monday' },
    'udayan': { day: 0, name: 'Sunday' },
    'udayan express': { day: 0, name: 'Sunday' },
    'drutojan': { day: 3, name: 'Wednesday' },
    'drutojan express': { day: 3, name: 'Wednesday' },
    'ekota': { day: 2, name: 'Tuesday' },
    'ekota express': { day: 2, name: 'Tuesday' },
    'lalmoni': { day: 5, name: 'Friday' },
    'lalmoni express': { day: 5, name: 'Friday' },
    'kurigram': { day: 3, name: 'Wednesday' },
    'kurigram express': { day: 3, name: 'Wednesday' },
    'rangpur': { day: 1, name: 'Monday' },
    'rangpur express': { day: 1, name: 'Monday' },
    'chitra': { day: 1, name: 'Monday' },
    'chitra express': { day: 1, name: 'Monday' },
    'sundarban': { day: 2, name: 'Tuesday' },
    'sundarban express': { day: 2, name: 'Tuesday' },
    'benapole': { day: 3, name: 'Wednesday' },
    'benapole express': { day: 3, name: 'Wednesday' },
    'modhumoti': { day: 4, name: 'Thursday' },
    'modhumoti express': { day: 4, name: 'Thursday' },
    'tista': { day: 1, name: 'Monday' },
    'tista express': { day: 1, name: 'Monday' },
    'burimari': { day: 2, name: 'Tuesday' },
    'burimari express': { day: 2, name: 'Tuesday' },
    'kishoreganj': { day: 5, name: 'Friday' },
    'kishoreganj express': { day: 5, name: 'Friday' },
    'egarosindhur godhuli': { day: 3, name: 'Wednesday' },
    'egarosindhur provati': { day: 3, name: 'Wednesday' },
  };

  function checkTrainOffDay(trainPrefsStr, dojIso) {
    if (!trainPrefsStr || !dojIso) return null;
    const d = fromIso(dojIso);
    if (!d) return null;
    const dayOfWeek = d.getDay();
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const prefs = parseTrainPrefs(trainPrefsStr);

    for (const pref of prefs) {
      for (const [trainKey, info] of Object.entries(TRAIN_OFF_DAYS)) {
        if (!info) continue;
        if (pref.includes(trainKey) || trainKey.includes(pref)) {
          if (info.day === dayOfWeek) {
            return {
              train: pref.toUpperCase(),
              dayName: info.name,
              journeyDay: DAYS[dayOfWeek],
              message: `⚠️ ${pref.toUpperCase()} does not run on ${DAYS[dayOfWeek]}s (Weekly Off-Day)!`,
            };
          }
        }
      }
    }
    return null;
  }

  return { SITE, CLASSES, KNOWN_STATIONS, TOP_STATIONS, EASTERN_STATIONS, TRAIN_OFF_DAYS, STATION_LABELS, stationLabel, canonicalStation, BOOKING_WINDOW_DAYS, today, toIso, fromIso, addDays, bookingWindow, isInWindow, releaseDateFor, tomorrowReleaseDate, todayMaxDate, toSiteDate, toShortDate, searchPath, parseTrainPrefs, checkTrainOffDay, seatRules, siteAlertText, cooldownSeconds, dismissSiteAlert, countdown, load, save, initTheme, detectRouteZone, playChime };
})();
