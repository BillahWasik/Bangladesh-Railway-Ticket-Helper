// Seat-hold countdown. seatmap.js stores `holdStart` when the first seat is selected (which is
// what makes the site hold it). This shows the time left on every page of the site, beeps at
// 60 s and 30 s, and says when the hold has probably run out. The length is the user's setting
// (settings.holdMinutes, default 5, 0 = off); it is our own clock, not the site's.
(() => {
  const DEFAULT_MINUTES = 5;
  const WARN_AT_S = [60, 30];
  const EXPIRED_SHOW_MS = 15 * 1000;
  const STALE_AFTER_MS = 60 * 60 * 1000; // a hold start this old is from an abandoned booking

  let ticker = null;
  let warned = new Set();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.holdStart || changes.settings) start();
  });
  start();

  async function start() {
    clearInterval(ticker);
    ticker = null;
    warned = new Set();
    const { holdStart, settings } = await BRTH.load(['holdStart', 'settings']);
    const minutes = Number(settings?.holdMinutes ?? DEFAULT_MINUTES);
    if (!holdStart || !minutes || Date.now() - holdStart > STALE_AFTER_MS) {
      BRTHBadge.hide('hold');
      return;
    }
    const endsAt = holdStart + minutes * 60 * 1000;
    if (Date.now() - endsAt > EXPIRED_SHOW_MS) { // expired a while ago: nothing to report
      BRTHBadge.hide('hold');
      return;
    }
    tick(endsAt);
    ticker = setInterval(() => tick(endsAt), 1000);
  }

  function tick(endsAt) {
    const left = Math.ceil((endsAt - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(ticker);
      ticker = null;
      BRTHBadge.show('Seat hold has probably expired. If payment fails, search and book again.',
        'error', EXPIRED_SHOW_MS, 'hold');
      beep(3);
      return;
    }
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, '0');
    const urgent = left <= WARN_AT_S[0];
    BRTHBadge.show(`Seats held for about ${mm}:${ss} more. Finish the OTP and payment.`,
      urgent ? 'warn' : 'info', 0, 'hold');
    for (const at of WARN_AT_S) {
      if (left <= at && !warned.has(at)) {
        warned.add(at);
        beep(at === WARN_AT_S[0] ? 2 : 3);
        break; // only the nearest threshold sounds if the page loaded late
      }
    }
  }

  // Short beeps via Web Audio. Chrome may keep audio silent until the page has had a click or key press.
  function beep(times) {
    try {
      const ctx = new AudioContext();
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.15);
      }
      setTimeout(() => ctx.close(), times * 300 + 300);
    } catch { /* no audio available */ }
  }
})();
