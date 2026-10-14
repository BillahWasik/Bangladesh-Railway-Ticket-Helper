const $ = (id) => document.getElementById(id);

init();

async function init() {
  if (BRTH.initTheme) BRTH.initTheme($('theme-toggle'));
  const { login = {}, settings = {} } = await BRTH.load(['login', 'settings']);
  $('mobile').value = login.mobile ?? '';
  $('password').value = login.password ?? '';
  $('auto-click').checked = login.autoClick ?? true;
  $('accept-disclaimer').checked = settings.acceptDisclaimer ?? false;
  $('auto-book-now').checked = settings.autoBookNow ?? true;
  $('auto-pick-seats').checked = settings.autoPickSeats ?? true;
  const autoContinueEl = $('auto-continue-purchase');
  if (autoContinueEl) autoContinueEl.checked = settings.autoContinuePurchase ?? true;
  $('seat-position').value = settings.seatPosition ?? 'window';
  $('seats-together').checked = settings.seatsTogether ?? true;
  const splitCoachesEl = $('split-coaches');
  if (splitCoachesEl) splitCoachesEl.checked = settings.splitCoaches ?? true;
  $('preferred-coaches').value = settings.preferredCoaches ?? '';
  $('auto-refresh').checked = settings.autoRefresh ?? false;
  $('refresh-secs').value = settings.refreshSecs ?? 5;
  $('max-refreshes').value = settings.maxRefreshes ?? 100;
  $('hold-minutes').value = settings.holdMinutes ?? 5;
  $('preferred-payment').value = settings.preferredPayment ?? '';
  $('toggle-password').addEventListener('click', () => {
    const hidden = $('password').type === 'password';
    $('password').type = hidden ? 'text' : 'password';
    $('toggle-password').textContent = hidden ? 'Hide' : 'Show';
  });

  $('login-form').addEventListener('submit', onSave);
  $('clear').addEventListener('click', onClear);
}

async function onSave(e) {
  e.preventDefault();
  const mobile = $('mobile').value.trim();
  if (mobile && !/^01[3-9]\d{8}$/.test(mobile)) {
    showStatus('Mobile number should be 11 digits and start with 01.', true);
    return;
  }
  await BRTH.save({
    login: { mobile, password: $('password').value, autoClick: $('auto-click').checked },
    // Kept apart from "login" so "Clear saved login" doesn't reset it.
    settings: {
      acceptDisclaimer: $('accept-disclaimer').checked,
      autoBookNow: $('auto-book-now').checked,
      autoPickSeats: $('auto-pick-seats').checked,
      autoContinuePurchase: $('auto-continue-purchase') ? $('auto-continue-purchase').checked : true,
      seatPosition: $('seat-position').value,
      seatsTogether: $('seats-together').checked,
      splitCoaches: $('split-coaches') ? $('split-coaches').checked : true,
      preferredCoaches: $('preferred-coaches').value.trim(),
      autoRefresh: $('auto-refresh').checked,
      refreshSecs: Math.min(120, Math.max(2, Number($('refresh-secs').value) || 5)),
      maxRefreshes: Math.min(1000, Math.max(0, $('max-refreshes').value === '' ? 100 : Number($('max-refreshes').value) || 0)),
      holdMinutes: Math.min(30, Math.max(0, $('hold-minutes').value === '' ? 5 : Number($('hold-minutes').value) || 0)),
      preferredPayment: $('preferred-payment').value,
    },
  });
  showStatus('Saved.');
}

async function onClear() {
  await chrome.storage.local.remove('login');
  $('mobile').value = '';
  $('password').value = '';
  $('auto-click').checked = true;
  showStatus('Saved login cleared.');
}

let statusTimer = null;
function showStatus(text, isError = false) {
  clearTimeout(statusTimer);
  const statusEl = $('status');
  statusEl.textContent = isError ? text : (text ? `✓ ${text}` : '');
  statusEl.classList.toggle('error', isError);
  if (!isError && text) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = '';
    }, 4000);
  }
}
