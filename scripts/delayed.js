// add delayed functionality here

import { publish, subscribe } from './analytics.js';

document.addEventListener('click', (event) => {
  try {
    const button = event.target.closest('.button');
    if (!button) return;

    const buttonName = button.dataset.analyticsName || button.textContent.trim();
    const nextPageName = button.getAttribute('href')
      ? (button.textContent.trim() || new URL(button.href, window.location.href).pathname)
      : 'no-target';

    publish('button:click', {
      event: 'button_click',
      timestamp: new Date().toISOString(),
      page: { pageName: document.title },
      button: { name: buttonName },
      target: { nextPageName },
    });
  } catch {
    // graceful degradation: analytics must never break the click's native behavior
  }
});

// Subscriber 1 (required): dummy analytics framework
subscribe('button:click', (digitalData) => {
  console.log('[dummy-analytics] digitalData:', digitalData);
});

// Subscriber 2 (demo-only, demonstrates multiple independent subscribers)
let clickCount = 0;
subscribe('button:click', () => {
  clickCount += 1;
  console.debug('[analytics] click count:', clickCount);
});

// Subscriber 3 (demo-only, on-page visual log): shows fired analytics events
// directly on the page, so a demo doesn't depend on the audience seeing
// DevTools console output.
function getAnalyticsPanel() {
  let panel = document.getElementById('analytics-demo-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'analytics-demo-panel';
  panel.style.cssText = [
    'position:fixed', 'right:16px', 'bottom:16px', 'width:340px', 'max-height:40vh',
    'overflow-y:auto', 'background:#1d1d1d', 'color:#eee', 'font:12px/1.4 monospace',
    'padding:10px 12px', 'border-radius:8px', 'box-shadow:0 4px 16px rgba(0,0,0,.3)',
    'z-index:9999',
  ].join(';');
  panel.innerHTML = '<strong style="display:block;margin-bottom:6px;">Analytics events (demo)</strong>';
  document.body.append(panel);
  return panel;
}

subscribe('button:click', (digitalData) => {
  const panel = getAnalyticsPanel();
  const entry = document.createElement('pre');
  entry.style.cssText = 'margin:0 0 8px;padding-bottom:8px;border-bottom:1px solid #444;white-space:pre-wrap;word-break:break-word;';
  entry.textContent = JSON.stringify(digitalData, null, 2);
  panel.append(entry);
  panel.scrollTop = panel.scrollHeight;
});
