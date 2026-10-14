// Part 1b: fill the login form with the saved credentials and, if allowed, click LOGIN
// once the page itself enables the button (form valid and Cloudflare check passed).
// It never tries to solve or skip the Cloudflare check.
(() => {
  // Set when we auto-click; cleared once a logged-in header is seen. If the login form
  // shows up again in the same tab while it is set, the last attempt failed, so we stop
  // auto-clicking rather than repeat a wrong password.
  const ATTEMPT_KEY = 'brth.autoLoginAttempt';
  const WAIT_LIMIT_MS = 3 * 60 * 1000;
  const HINT_AFTER_MS = 8000;
  // Clicking the instant Cloudflare's token appears can beat the site's own code to it, and
  // the site then answers "Turnstile token is required". Let the token sit this long first.
  const SETTLE_MS = 1200;
  const OUTCOME_WAIT_MS = 6000;
  const TURNSTILE_ERROR = 'Turnstile token is required';

  let activeForm = null;
  const say = (message, tone, hideAfterMs) => BRTHBadge.show(message, tone, hideAfterMs, 'login');

  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  check();

  // The site is a single-page app, so the login form can appear without a page load.
  function check() {
    if (document.querySelector('.railway-logged-user') && sessionStorage.getItem(ATTEMPT_KEY) !== null) {
      sessionStorage.removeItem(ATTEMPT_KEY);
      say('Logged in.', 'info', 3000);
    }
    const form = document.getElementById('loginForm');
    if (form && form !== activeForm) {
      activeForm = form;
      handle(form);
    }
  }

  async function handle(form) {
    const { login } = await BRTH.load('login');
    if (!login?.mobile) {
      say('No login saved. Add it under Login settings in the extension pop-up.', 'warn');
      return;
    }

    const mobile = form.querySelector('#mobile_number');
    const password = form.querySelector('#password');
    const submit = form.querySelector('button[type="submit"]');
    if (!mobile || !password || !submit) {
      say("The login page has changed and the extension can't find its fields.", 'error');
      return;
    }

    fill(mobile, login.mobile);
    if (login.password) fill(password, login.password);

    const lastAttemptFailed = sessionStorage.getItem(ATTEMPT_KEY) !== null;
    const autoClick = login.autoClick !== false && !lastAttemptFailed;

    say('Filled your login. Waiting for the Cloudflare check…');
    if (!(await waitUntilReady(form, submit, password))) return;

    if (lastAttemptFailed) {
      say(
        "The last automatic login in this tab didn't work, so auto-click is paused. " +
        'Check the saved password, then click LOGIN yourself.', 'warn');
      return;
    }
    if (!autoClick) {
      say('Ready. Click LOGIN when you want.');
      return;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      const hadError = hasTurnstileError(form);
      sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()));
      say(attempt === 1 ? 'Clicking LOGIN…' : 'Clicking LOGIN again…');
      submit.click();

      const outcome = await waitForOutcome(form, hadError);
      if (outcome === 'done') return; // the logged-in header triggers the "Logged in." notice
      if (outcome === 'unknown') {
        // Still on the form with no Cloudflare complaint: most likely the site's own error, e.g. a
        // wrong password. A slow successful login still replaces this with "Logged in.".
        say("Still on the login page. If the site shows an error, check your saved password " +
          'in Login settings.', 'warn');
        return;
      }

      // The site hadn't picked up Cloudflare's pass yet. That isn't a wrong password,
      // so it must not pause auto-login for this tab.
      sessionStorage.removeItem(ATTEMPT_KEY);
      if (attempt === 2) break;
      say("The site hadn't received the Cloudflare pass yet. Trying once more…", 'warn');
      await sleep(2000);
      if (!(await waitUntilReady(form, submit, password))) return;
    }
    say('The site still says the Cloudflare check is missing. Click LOGIN yourself, ' +
      'or reload the page if that fails too.', 'warn');
  }

  // Resolves true once LOGIN is enabled and Cloudflare's token has stayed unchanged for
  // SETTLE_MS; false if the user leaves the page or it takes too long.
  async function waitUntilReady(form, submit, password) {
    const started = Date.now();
    let hinted = false;
    let stableToken; // undefined = not ready yet
    let stableSince = 0;

    while (form.isConnected) {
      const token = tokenValue(form);
      if (!submit.disabled && token !== '') {
        if (token !== stableToken) {
          stableToken = token;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= SETTLE_MS) {
          return true;
        }
      } else {
        stableToken = undefined;
      }

      const waited = Date.now() - started;
      if (waited > WAIT_LIMIT_MS) {
        say('Gave up waiting for LOGIN to become clickable. Reload the page to try again.', 'error');
        return false;
      }
      if (!hinted && waited > HINT_AFTER_MS) {
        hinted = true;
        say(waitingReason(form, password), 'warn');
      }
      await sleep(250);
    }
    return false; // user left the login page
  }

  // 'done' (logged in or left the page), 'turnstile' (site rejected the Cloudflare pass) or 'unknown'.
  // If the error was already showing before this click, only a timeout can tell us it came back.
  async function waitForOutcome(form, hadError) {
    const started = Date.now();
    while (Date.now() - started < OUTCOME_WAIT_MS) {
      await sleep(250);
      if (!form.isConnected || document.querySelector('.railway-logged-user')) return 'done';
      if (!hadError && hasTurnstileError(form)) return 'turnstile';
    }
    return hasTurnstileError(form) ? 'turnstile' : 'unknown';
  }

  function hasTurnstileError(form) {
    return form.textContent.includes(TURNSTILE_ERROR);
  }

  // Cloudflare Turnstile writes its pass token into this hidden input.
  // null = no Cloudflare check on the form, '' = not passed yet.
  function tokenValue(form) {
    return form.querySelector('input[name="cf-turnstile-response"]')?.value ?? null;
  }

  function waitingReason(form, password) {
    if (!password.value) return 'Type your password to continue.';
    if (tokenValue(form) === '') {
      return 'Still waiting for Cloudflare. If it shows a checkbox or puzzle, solve it yourself.';
    }
    return 'LOGIN is still disabled. Check the mobile number and password on the form.';
  }

  // The site uses Angular forms, which pick up values from the input event.
  function fill(el, value) {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
