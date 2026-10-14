// Clicks I AGREE on the site's Disclaimer, but only if the user switched this on in Login settings.
// It always says so in the panel, so accepting the Terms on the user's behalf is never silent.
(() => {
  let handled = null;

  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  check();

  async function check() {
    const button = document.querySelector('app-disclaimer-modal .agree-btn');
    if (!button || button === handled) return;
    handled = button;

    const { settings } = await BRTH.load('settings');
    if (!settings?.acceptDisclaimer || !button.isConnected) return;

    button.click();
    BRTHBadge.show('Clicked I AGREE on the Disclaimer for you (turn off in Login settings).',
      'info', 5000, 'disclaimer');
  }
})();
