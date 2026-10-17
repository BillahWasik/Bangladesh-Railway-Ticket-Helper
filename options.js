const $ = (id) => document.getElementById(id);

init();

async function init() {
  if (BRTH.initTheme) BRTH.initTheme($('theme-toggle'));
  const { login = {}, settings = {}, trip = {}, coPassengers = [] } = await BRTH.load(['login', 'settings', 'trip', 'coPassengers']);
  $('mobile').value = login.mobile ?? '';
  $('password').value = login.password ?? '';
  $('auto-click').checked = login.autoClick ?? true;
  $('accept-disclaimer').checked = settings.acceptDisclaimer ?? false;
  $('auto-book-now').checked = settings.autoBookNow ?? true;
  $('auto-pick-seats').checked = settings.autoPickSeats ?? true;
  const autoContinueEl = $('auto-continue-purchase');
  if (autoContinueEl) autoContinueEl.checked = settings.autoContinuePurchase ?? trip.autoContinuePurchase ?? true;
  $('seat-position').value = settings.seatPosition ?? 'window';
  $('seats-together').checked = settings.seatsTogether ?? true;
  const splitCoachesEl = $('split-coaches');
  if (splitCoachesEl) splitCoachesEl.checked = settings.splitCoaches ?? true;
  $('preferred-coaches').value = settings.preferredCoaches ?? '';
  if ($('boarding-station')) $('boarding-station').value = settings.boardingStation ?? '';
  $('auto-refresh').checked = settings.autoRefresh ?? false;
  if ($('server-error-retry')) $('server-error-retry').checked = settings.serverErrorRetry ?? true;
  $('refresh-secs').value = settings.refreshSecs ?? 5;
  $('max-refreshes').value = settings.maxRefreshes ?? 100;
  $('hold-minutes').value = settings.holdMinutes ?? 5;
  $('preferred-payment').value = settings.preferredPayment ?? '';

  // New checkout, OTP, sound and keep-alive settings
  if ($('auto-confirm-payment')) $('auto-confirm-payment').checked = settings.autoConfirmPayment ?? false;
  if ($('auto-otp')) $('auto-otp').checked = settings.autoOtp ?? true;
  if ($('sound-alerts')) $('sound-alerts').checked = settings.soundAlerts ?? true;
  if ($('keep-alive')) $('keep-alive').checked = settings.keepAlive ?? true;

  // Test chime audio buttons
  $('test-seat-chime-btn')?.addEventListener('click', () => {
    if (BRTH.playChime) BRTH.playChime('seatFound');
  });
  $('test-otp-chime-btn')?.addEventListener('click', () => {
    if (BRTH.playChime) BRTH.playChime('otp');
  });

  // Co-passenger details
  if ($('pass-name-2')) $('pass-name-2').value = coPassengers[0]?.name ?? '';
  if ($('pass-type-2')) $('pass-type-2').value = coPassengers[0]?.type ?? 'ADULT';
  if ($('pass-name-3')) $('pass-name-3').value = coPassengers[1]?.name ?? '';
  if ($('pass-type-3')) $('pass-type-3').value = coPassengers[1]?.type ?? 'ADULT';
  if ($('pass-name-4')) $('pass-name-4').value = coPassengers[2]?.name ?? '';
  if ($('pass-type-4')) $('pass-type-4').value = coPassengers[2]?.type ?? 'ADULT';

  $('toggle-password').addEventListener('click', () => {
    const hidden = $('password').type === 'password';
    $('password').type = hidden ? 'text' : 'password';
    $('toggle-password').textContent = hidden ? 'Hide' : 'Show';
  });

  // Profile Export & Import
  const exportBtn = $('export-profile-btn');
  const importBtn = $('import-profile-btn');
  const fileInput = $('import-file-input');

  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const data = await BRTH.load(['login', 'settings', 'trip', 'coPassengers']);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `br-ticket-helper-profile-${BRTH.toIso(BRTH.today())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Profile exported to JSON.');
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (typeof imported === 'object' && imported !== null) {
          await BRTH.save(imported);
          await init();
          showStatus('✓ Profile imported and restored successfully!');
        } else {
          showStatus('Invalid profile JSON file.', true);
        }
      } catch {
        showStatus('Failed to read or parse profile file.', true);
      } finally {
        fileInput.value = '';
      }
    });
  }

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

  const coPassengers = [
    { name: $('pass-name-2') ? $('pass-name-2').value.trim() : '', type: $('pass-type-2') ? $('pass-type-2').value : 'ADULT' },
    { name: $('pass-name-3') ? $('pass-name-3').value.trim() : '', type: $('pass-type-3') ? $('pass-type-3').value : 'ADULT' },
    { name: $('pass-name-4') ? $('pass-name-4').value.trim() : '', type: $('pass-type-4') ? $('pass-type-4').value : 'ADULT' },
  ];

  await BRTH.save({
    login: { mobile, password: $('password').value, autoClick: $('auto-click').checked },
    coPassengers,
    settings: {
      acceptDisclaimer: $('accept-disclaimer').checked,
      autoBookNow: $('auto-book-now').checked,
      autoPickSeats: $('auto-pick-seats').checked,
      autoContinuePurchase: $('auto-continue-purchase') ? $('auto-continue-purchase').checked : true,
      seatPosition: $('seat-position').value,
      seatsTogether: $('seats-together').checked,
      splitCoaches: $('split-coaches') ? $('split-coaches').checked : true,
      preferredCoaches: $('preferred-coaches').value.trim(),
      boardingStation: $('boarding-station') ? $('boarding-station').value.trim() : '',
      autoRefresh: $('auto-refresh').checked,
      serverErrorRetry: $('server-error-retry') ? $('server-error-retry').checked : true,
      refreshSecs: Math.min(120, Math.max(2, Number($('refresh-secs').value) || 5)),
      maxRefreshes: Math.min(1000, Math.max(0, $('max-refreshes').value === '' ? 100 : Number($('max-refreshes').value) || 0)),
      holdMinutes: Math.min(30, Math.max(0, $('hold-minutes').value === '' ? 5 : Number($('hold-minutes').value) || 0)),
      preferredPayment: $('preferred-payment').value,
      autoConfirmPayment: $('auto-confirm-payment') ? $('auto-confirm-payment').checked : false,
      autoOtp: $('auto-otp') ? $('auto-otp').checked : true,
      soundAlerts: $('sound-alerts') ? $('sound-alerts').checked : true,
      keepAlive: $('keep-alive') ? $('keep-alive').checked : true,
    },
  });

  const { trip } = await BRTH.load(['trip']);
  if (trip) {
    trip.autoContinuePurchase = $('auto-continue-purchase') ? $('auto-continue-purchase').checked : true;
    await BRTH.save({ trip });
  }

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
