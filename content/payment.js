(() => {
  const PATH_FRAGMENTS = ['/payment', '/checkout', '/confirm', '/passenger', '/booking'];
  let autoPaymentClicked = false;
  let autoPassengersFilled = false;
  let otpHandled = false;
  let boardingStationSelected = false;

  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();

  async function scan() {
    const isTargetPage = PATH_FRAGMENTS.some((p) => location.pathname.toLowerCase().includes(p)) ||
      document.querySelector('input#otp, input[name*="otp" i], input[placeholder*="otp" i]') !== null;

    if (!isTargetPage) return;

    const { settings = {}, coPassengers = [] } = await BRTH.load(['settings', 'coPassengers']);

    // 1. Handle Co-Passenger Autofill
    if (!autoPassengersFilled && coPassengers && coPassengers.length > 0) {
      handlePassengerAutofill(coPassengers);
    }

    // 2. Handle OTP Detection & Auto-Submit
    if (settings.autoOtp !== false) {
      handleOtpVerification(settings);
    }

    // 3. Handle Payment Method Selection & Auto-Proceed
    if (!autoPaymentClicked && settings.preferredPayment) {
      handlePaymentSelection(settings);
    }

    // 4. Handle Preferred Boarding Station Selection
    if (!boardingStationSelected && settings.boardingStation) {
      handleBoardingStation(settings.boardingStation);
    }

    // 5. Handle bKash / Nagad Wallet Number Autofill
    if (settings.walletNumber) {
      handleWalletAutofill(settings.walletNumber);
    }
  }

  // Auto-fill co-passenger details (Passenger 2, 3, 4) on checkout / passenger details form
  function handlePassengerAutofill(coPassengers) {
    // Find text inputs for passenger names (excluding the primary passenger 1 if already locked/filled)
    const nameInputs = Array.from(document.querySelectorAll(
      'input[name*="passenger" i], input[id*="passenger" i], input[placeholder*="passenger" i], input[formcontrolname*="name" i]'
    )).filter((el) => el.type === 'text' && !el.disabled && !el.readOnly);

    if (!nameInputs.length) return;

    // Usually Passenger 1 is already filled with account user; check if first input already has value
    let targetInputs = nameInputs;
    if (nameInputs.length > 1 && nameInputs[0].value.trim()) {
      targetInputs = nameInputs.slice(1);
    }

    let filledCount = 0;
    targetInputs.forEach((input, index) => {
      const coPassenger = coPassengers[index];
      if (coPassenger && coPassenger.name && !input.value.trim()) {
        input.value = coPassenger.name.trim();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;

        // Find associated passenger type dropdown (Adult / Child)
        const parentCard = input.closest('tr, .passenger-box, .single-passenger, [formgroupname], .card, div') || input.parentElement;
        if (parentCard) {
          const typeSelect = parentCard.querySelector('select');
          if (typeSelect && coPassenger.type) {
            const targetType = coPassenger.type.toUpperCase();
            const option = Array.from(typeSelect.options).find((opt) => opt.value.toUpperCase().includes(targetType) || opt.text.toUpperCase().includes(targetType));
            if (option) {
              typeSelect.value = option.value;
              typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      }
    });

    if (filledCount > 0) {
      autoPassengersFilled = true;
      BRTHBadge?.show(`Auto-filled ${filledCount} co-passenger name${filledCount > 1 ? 's' : ''}!`, 'info', 4000, 'passenger');
    }
  }

  // Detect OTP input screen, play chime, focus input, and auto-submit on 6 digits
  function handleOtpVerification(settings) {
    const otpInput = document.querySelector('input#otp, input[name*="otp" i], input[placeholder*="otp" i], input[formcontrolname*="otp" i], .otp-input');
    if (!otpInput) {
      otpHandled = false;
      return;
    }

    if (!otpHandled) {
      otpHandled = true;
      otpInput.focus();

      if (BRTH.playChime && settings.soundAlerts !== false) {
        BRTH.playChime('otp');
      }

      try {
        chrome.runtime.sendMessage({
          action: 'notify',
          title: '📱 OTP Verification Required!',
          message: 'OTP screen is open on Bangladesh Railway! Check your phone SMS.',
        });
      } catch { /* background idle */ }

      BRTHBadge?.show('OTP verification screen detected! Check your SMS. Auto-submitting on 6 digits.', 'info', 6000, 'otp');

      if (settings.smartClipboardOtp !== false) {
        setupClipboardOtpListener(otpInput);
      }

      // Auto-submit when exactly 6 digits are entered
      otpInput.addEventListener('input', () => {
        const cleaned = otpInput.value.replace(/\D/g, '');
        if (cleaned.length === 6) {
          const verifyBtn = document.querySelector('button[type="submit"], button.btn-verify, button.verify-btn') ||
            Array.from(document.querySelectorAll('button')).find((b) => /verify|confirm|submit|validate/i.test(b.textContent.trim()));

          if (verifyBtn && !verifyBtn.disabled) {
            BRTHBadge?.show('6-digit OTP entered. Submitting…', 'info', 2500, 'otp');
            setTimeout(() => verifyBtn.click(), 250);
          }
        }
      });
    }
  }

  // Select preferred payment method and optionally auto-advance to gateway
  function handlePaymentSelection(settings) {
    const method = settings.preferredPayment.toLowerCase();

    // Look for images or buttons containing the payment method name
    const elements = [...document.querySelectorAll('img, button, div, a, label')];
    for (const el of elements) {
      const text = (el.textContent || '').toLowerCase();
      const alt = (el.getAttribute('alt') || '').toLowerCase();
      const value = (el.getAttribute('value') || '').toLowerCase();

      if (text.includes(method) || alt.includes(method) || value.includes(method)) {
        const clickable = el.closest('button, a, label, .payment-option') || el;
        autoPaymentClicked = true;

        setTimeout(() => {
          clickable.click();
          BRTHBadge?.show(`Auto-selecting ${settings.preferredPayment}...`, 'info', 3000, 'payment');

          // Optionally auto-advance to payment portal
          if (settings.autoConfirmPayment) {
            setTimeout(() => {
              const proceedBtn = document.querySelector('button[type="submit"], button.btn-proceed, button.pay-now') ||
                Array.from(document.querySelectorAll('button')).find((b) => /proceed|confirm\s*payment|pay\s*now/i.test(b.textContent.trim()));
              if (proceedBtn && !proceedBtn.disabled) {
                BRTHBadge?.show(`Proceeding to ${settings.preferredPayment} gateway…`, 'info', 3000, 'payment');
                proceedBtn.click();
              }
            }, 600);
          }
        }, 500);
        break;
      }
    }
  }

  function handleBoardingStation(pref) {
    if (!pref) return;
    const target = pref.trim().toLowerCase();
    const selects = Array.from(document.querySelectorAll(
      'select[name*="boarding" i], select[id*="boarding" i], select[formcontrolname*="boarding" i]'
    ));
    for (const sel of selects) {
      const match = Array.from(sel.options).find((opt) => {
        const val = (opt.value || '').toLowerCase();
        const text = (opt.textContent || '').toLowerCase();
        return val.includes(target) || text.includes(target) || target.includes(val) || target.includes(text);
      });
      if (match && sel.value !== match.value) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        boardingStationSelected = true;
        BRTHBadge?.show(`Selected boarding station: ${match.textContent.trim()}`, 'info', 4000, 'boarding');
        break;
      }
    }
  }

  let walletAutofilled = false;
  function handleWalletAutofill(walletNum) {
    if (walletAutofilled || !walletNum) return;
    const walletInput = document.querySelector(
      'input[placeholder*="wallet" i], input[placeholder*="01" i], input[name*="wallet" i], input[name*="account" i], input#account_number, input#wallet_number'
    );
    if (walletInput && !walletInput.value.trim() && !walletInput.disabled) {
      walletInput.value = walletNum.trim();
      walletInput.dispatchEvent(new Event('input', { bubbles: true }));
      walletInput.dispatchEvent(new Event('change', { bubbles: true }));
      walletAutofilled = true;
      BRTHBadge?.show(`Auto-filled wallet ${walletNum}!`, 'info', 3000, 'wallet');
    }
  }

  let clipboardListenerAttached = false;
  function setupClipboardOtpListener(otpInput) {
    if (clipboardListenerAttached) return;
    clipboardListenerAttached = true;

    window.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const match = text.match(/\b\d{6}\b/);
      if (match && otpInput && otpInput.isConnected) {
        e.preventDefault();
        otpInput.value = match[0];
        otpInput.dispatchEvent(new Event('input', { bubbles: true }));
        otpInput.dispatchEvent(new Event('change', { bubbles: true }));
        BRTHBadge?.show(`Extracted OTP ${match[0]} from clipboard! Submitting…`, 'info', 3000, 'otp');
      }
    });
  }
})();
