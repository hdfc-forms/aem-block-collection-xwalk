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
