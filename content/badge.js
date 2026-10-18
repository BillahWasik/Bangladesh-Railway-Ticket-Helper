// Small status panel shown on the railway site. A shadow root keeps the site's CSS off it.
// Each feature writes under its own key (login, results, disclaimer) so messages stack
// instead of overwriting each other.
const BRTHBadge = (() => {
  const RANK = { info: 0, warn: 1, error: 2 };
  const messages = new Map(); // key -> { message, tone, timer, action }
  let host = null;
  let text = null;
  let actionsContainer = null;

  function ensure() {
    if (host?.isConnected) return;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host {
          --brand: #059669;
          --tone-color: #059669;
          --tone-soft: rgba(5, 150, 105, 0.1);
        }
        :host([data-tone="warn"]) {
          --tone-color: #d97706;
          --tone-soft: rgba(217, 119, 6, 0.12);
        }
        :host([data-tone="error"]) {
          --tone-color: #dc2626;
          --tone-soft: rgba(220, 38, 38, 0.12);
        }
        .box {
          position: relative;
          max-width: 380px;
          padding: 12px 34px 12px 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12.5px;
          line-height: 1.45;
          color: #0f172a;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(226, 232, 240, 0.9);
          border-left: 4px solid var(--tone-color);
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08);
          animation: slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .badge-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }
        .indicator-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--tone-color);
          box-shadow: 0 0 6px var(--tone-color);
        }
        strong {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--tone-color);
        }
        .text {
          white-space: pre-line;
          color: #334155;
          font-weight: 450;
        }
        .badge-actions {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .badge-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 12px;
          font-family: inherit;
          font-size: 11.5px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 140ms ease;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: var(--tone-color);
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .badge-action-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 3px 6px rgba(0,0,0,0.15);
        }
        .badge-action-btn.danger {
          background: #dc2626;
          color: #ffffff;
        }
        .close-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
          color: #94a3b8;
          border-radius: 4px;
          transition: all 140ms ease;
          padding: 0;
        }
        .close-btn:hover {
          color: #0f172a;
          background: rgba(15, 23, 42, 0.06);
        }
      </style>
      <div class="box" role="status">
        <div class="badge-header">
          <span class="indicator-dot"></span>
          <strong>BR Ticket Helper</strong>
        </div>
        <div class="text"></div>
        <div class="badge-actions"></div>
        <button type="button" class="close-btn" aria-label="Dismiss notification">&times;</button>
      </div>`;
    text = root.querySelector('.text');
    actionsContainer = root.querySelector('.badge-actions');
    root.querySelector('.close-btn').addEventListener('click', () => hide());
    document.body.append(host);
  }

  // tone: 'info' | 'warn' | 'error'. Showing again under the same key replaces that message
  // and cancels its pending auto-hide.
  function show(message, tone = 'info', hideAfterMs = 0, key = 'main', action = null) {
    clearTimeout(messages.get(key)?.timer);
    const entry = { message, tone, timer: null, action };
    if (hideAfterMs) entry.timer = setTimeout(() => hide(key), hideAfterMs);
    messages.set(key, entry);
    render();
  }

  // No key: close the whole panel (the × button).
  function hide(key) {
    const keys = key === undefined ? [...messages.keys()] : [key];
    for (const k of keys) {
      clearTimeout(messages.get(k)?.timer);
      messages.delete(k);
    }
    render();
  }

  function render() {
    if (!messages.size) {
      host?.remove();
      host = null;
      return;
    }
    ensure();
    const entries = [...messages.values()];
    text.textContent = entries.map((e) => e.message).join('\n\n');
    host.dataset.tone = entries.reduce((worst, e) => (RANK[e.tone] > RANK[worst] ? e.tone : worst), 'info');

    if (actionsContainer) {
      actionsContainer.replaceChildren();
      for (const entry of entries) {
        if (entry.action) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `badge-action-btn ${entry.action.danger ? 'danger' : ''}`;
          btn.textContent = entry.action.label;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            entry.action.onClick?.();
          });
          actionsContainer.append(btn);
        }
      }
    }
  }

  return { show, hide };
})();
