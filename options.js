const $ = (id) => document.getElementById(id);
let multiAccountsList = [];
let activeEditingAccId = 'acc_1';

init();

async function init() {
  if (BRTH.initTheme) BRTH.initTheme($('theme-toggle'));
  const { login = {}, settings = {}, trip = {}, coPassengers = [], multiAccounts = [] } = await BRTH.load(['login', 'settings', 'trip', 'coPassengers', 'multiAccounts']);
  $('mobile').value = login.mobile ?? '';
  $('password').value = login.password ?? '';
  $('auto-click').checked = login.autoClick ?? true;
  $('accept-disclaimer').checked = settings.acceptDisclaimer ?? false;
  $('auto-book-now').checked = settings.autoBookNow ?? true;
  $('auto-pick-seats').checked = settings.autoPickSeats ?? true;
  const autoContinueEl = $('auto-continue-purchase');
  if (autoContinueEl) autoContinueEl.checked = settings.autoContinuePurchase ?? trip.autoContinuePurchase ?? true;
  const previewEl = $('preview-mode');
  if (previewEl) {
    previewEl.checked = settings.previewMode ?? trip.previewMode ?? false;
    previewEl.addEventListener('change', () => {
      if (previewEl.checked && autoContinueEl) {
        autoContinueEl.checked = false;
      }
    });
  }
  if (autoContinueEl) {
    autoContinueEl.addEventListener('change', () => {
      if (autoContinueEl.checked && previewEl) {
        previewEl.checked = false;
      }
    });
  }
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

  if ($('avoid-lavatory')) $('avoid-lavatory').checked = settings.avoidLavatory ?? true;
  if ($('auto-confirm-payment')) $('auto-confirm-payment').checked = settings.autoConfirmPayment ?? false;
  if ($('auto-otp')) $('auto-otp').checked = settings.autoOtp ?? true;
  if ($('smart-clipboard-otp')) $('smart-clipboard-otp').checked = settings.smartClipboardOtp ?? true;
  if ($('wallet-number')) $('wallet-number').value = settings.walletNumber ?? '';
  if ($('sound-alerts')) $('sound-alerts').checked = settings.soundAlerts ?? true;
  if ($('keep-alive')) $('keep-alive').checked = settings.keepAlive ?? true;

  // Test chime audio buttons
  $('test-seat-chime-btn')?.addEventListener('click', () => {
    if (BRTH.playChime) BRTH.playChime('seatFound');
  });
  $('test-otp-chime-btn')?.addEventListener('click', () => {
    if (BRTH.playChime) BRTH.playChime('otp');
  });

  // Multi-Account Section Setup (ON / OFF choice)
  setupMultiAccountSection(multiAccounts, settings, login, coPassengers);

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

  saveCurrentFieldsToAccount();
  const isMultiMode = $('multi-account-mode') ? $('multi-account-mode').checked : false;

  await BRTH.save({
    login: { mobile, password: $('password').value, autoClick: $('auto-click').checked },
    coPassengers,
    multiAccounts: multiAccountsList,
    settings: {
      acceptDisclaimer: $('accept-disclaimer').checked,
      multiAccountMode: isMultiMode,
      activeAccountId: activeEditingAccId,
      autoBookNow: $('auto-book-now').checked,
      autoPickSeats: $('auto-pick-seats').checked,
      autoContinuePurchase: $('auto-continue-purchase') ? $('auto-continue-purchase').checked : true,
      previewMode: $('preview-mode') ? $('preview-mode').checked : false,
      seatPosition: $('seat-position').value,
      seatsTogether: $('seats-together').checked,
      splitCoaches: $('split-coaches') ? $('split-coaches').checked : true,
      avoidLavatory: $('avoid-lavatory') ? $('avoid-lavatory').checked : true,
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
      smartClipboardOtp: $('smart-clipboard-otp') ? $('smart-clipboard-otp').checked : true,
      walletNumber: $('wallet-number') ? $('wallet-number').value.trim() : '',
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

function setupMultiAccountSection(multiAccounts, settings, login, coPassengers) {
  const modeCheckbox = $('multi-account-mode');
  const container = $('multi-account-container');
  if (!modeCheckbox || !container) return;

  modeCheckbox.checked = settings.multiAccountMode ?? false;
  container.hidden = !modeCheckbox.checked;

  modeCheckbox.addEventListener('change', () => {
    container.hidden = !modeCheckbox.checked;
  });

  if (Array.isArray(multiAccounts) && multiAccounts.length > 0) {
    multiAccountsList = JSON.parse(JSON.stringify(multiAccounts));
  } else {
    multiAccountsList = [
      {
        id: 'acc_1',
        name: 'Account 1 (Primary)',
        mobile: login.mobile ?? '',
        password: login.password ?? '',
        coaches: settings.preferredCoaches ?? '',
        passengers: [coPassengers[0]?.name ?? '', coPassengers[1]?.name ?? '', coPassengers[2]?.name ?? ''],
      },
      {
        id: 'acc_2',
        name: 'Account 2 (Family)',
        mobile: '',
        password: '',
        coaches: '',
        passengers: ['', '', ''],
      },
    ];
  }

  activeEditingAccId = multiAccountsList[0]?.id || 'acc_1';
  renderTabs();
  loadAccountIntoFields(activeEditingAccId);

  $('add-account-btn')?.addEventListener('click', () => {
    if (multiAccountsList.length >= 4) {
      showStatus('Maximum 4 accounts allowed (16 seats).', true);
      return;
    }
    saveCurrentFieldsToAccount();
    const newIdx = multiAccountsList.length + 1;
    const newAcc = {
      id: `acc_${Date.now()}`,
      name: `Account ${newIdx} (Secondary)`,
      mobile: '',
      password: '',
      coaches: '',
      passengers: ['', '', ''],
    };
    multiAccountsList.push(newAcc);
    activeEditingAccId = newAcc.id;
    renderTabs();
    loadAccountIntoFields(activeEditingAccId);
  });

  $('remove-account-btn')?.addEventListener('click', () => {
    if (multiAccountsList.length <= 1) {
      showStatus('You must keep at least 1 account.', true);
      return;
    }
    multiAccountsList = multiAccountsList.filter((a) => a.id !== activeEditingAccId);
    activeEditingAccId = multiAccountsList[0].id;
    renderTabs();
    loadAccountIntoFields(activeEditingAccId);
  });

  $('export-single-account-btn')?.addEventListener('click', async () => {
    saveCurrentFieldsToAccount();
    const acc = multiAccountsList.find((a) => a.id === activeEditingAccId);
    if (!acc) return;
    const { trip, settings: curSettings = {} } = await BRTH.load(['trip', 'settings']);
    const exportData = {
      login: { mobile: acc.mobile, password: acc.password, autoClick: true },
      coPassengers: [
        { name: acc.passengers[0] || '', type: 'ADULT' },
        { name: acc.passengers[1] || '', type: 'ADULT' },
        { name: acc.passengers[2] || '', type: 'ADULT' },
      ],
      settings: {
        ...curSettings,
        preferredCoaches: acc.coaches,
      },
      trip,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brth-${acc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}-profile.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus(`Exported ${acc.name} configuration for 2nd Chrome window!`);
  });
}

function renderTabs() {
  const tabsContainer = $('account-tabs');
  if (!tabsContainer) return;
  tabsContainer.replaceChildren();
  multiAccountsList.forEach((acc) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `account-tab-btn ${acc.id === activeEditingAccId ? 'active' : ''}`;
    btn.textContent = acc.name;
    btn.addEventListener('click', () => {
      saveCurrentFieldsToAccount();
      activeEditingAccId = acc.id;
      renderTabs();
      loadAccountIntoFields(acc.id);
    });
    tabsContainer.appendChild(btn);
  });
}

function loadAccountIntoFields(accId) {
  const acc = multiAccountsList.find((a) => a.id === accId);
  if (!acc) return;
  if ($('cur-account-heading')) $('cur-account-heading').textContent = `Editing: ${acc.name}`;
  if ($('acc-name')) $('acc-name').value = acc.name;
  if ($('acc-mobile')) $('acc-mobile').value = acc.mobile;
  if ($('acc-password')) $('acc-password').value = acc.password;
  if ($('acc-coaches')) $('acc-coaches').value = acc.coaches;
  if ($('acc-pass-2')) $('acc-pass-2').value = acc.passengers[0] || '';
  if ($('acc-pass-3')) $('acc-pass-3').value = acc.passengers[1] || '';
  if ($('acc-pass-4')) $('acc-pass-4').value = acc.passengers[2] || '';
}

function saveCurrentFieldsToAccount() {
  const acc = multiAccountsList.find((a) => a.id === activeEditingAccId);
  if (!acc) return;
  if ($('acc-name')) acc.name = $('acc-name').value.trim() || acc.name;
  if ($('acc-mobile')) acc.mobile = $('acc-mobile').value.trim();
  if ($('acc-password')) acc.password = $('acc-password').value;
  if ($('acc-coaches')) acc.coaches = $('acc-coaches').value.trim();
  acc.passengers = [
    $('acc-pass-2')?.value.trim() || '',
    $('acc-pass-3')?.value.trim() || '',
    $('acc-pass-4')?.value.trim() || '',
  ];
}
