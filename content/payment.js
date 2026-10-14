(() => {
  const PATH_FRAGMENTS = ['/payment', '/checkout', '/confirm'];
  let autoClicked = false;
  
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();

  async function scan() {
    if (autoClicked) return;
    if (!PATH_FRAGMENTS.some(p => location.pathname.toLowerCase().includes(p))) return;

    const { settings } = await BRTH.load(['settings']);
    if (!settings?.preferredPayment) return;
    
    const method = settings.preferredPayment.toLowerCase();
    
    // Look for images or buttons containing the payment method name
    const elements = [...document.querySelectorAll('img, button, div, a')];
    for (const el of elements) {
      const text = (el.textContent || '').toLowerCase();
      const alt = (el.getAttribute('alt') || '').toLowerCase();
      const value = (el.getAttribute('value') || '').toLowerCase();
      
      if (text.includes(method) || alt.includes(method) || value.includes(method)) {
        // Find the closest clickable parent if it's an image
        const clickable = el.closest('button, a, label, .payment-option') || el;
        
        // Wait a bit so the user can see it happen and the page settles
        autoClicked = true;
        setTimeout(() => {
          clickable.click();
          BRTHBadge?.show(`Auto-selecting ${settings.preferredPayment}...`, 'info', 3000, 'payment');
        }, 500);
        break;
      }
    }
  }
})();
