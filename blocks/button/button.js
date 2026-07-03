import { publish } from '../../scripts/analytics.js';
import callApi from '../../scripts/api-client.js';

// Field order matches _button.json's single 'nav-button' model exactly - xwalk
// renders each model field as a positional <div><div>value</div></div> (or
// <div><div><a href="...">...</a></div></div> for the aem-content
// apiSuccessPage field), so readFields() reads block.children by index.
const FIELD_ORDER = ['navMode', 'link', 'linkText', 'linkTitle', 'linkType', 'apiSuccessPage'];

function readFields(block) {
  const values = {};
  [...block.children].forEach((cell, i) => {
    const name = FIELD_ORDER[i];
    if (!name) return;
    const link = cell.querySelector('a');
    values[name] = link ? link.getAttribute('href') : cell.textContent.trim();
  });
  return values;
}

/**
 * Publishes a button:click analytics event. Kept as a small wrapper so every
 * navigation type builds the same digitalData shape used elsewhere on the site.
 * @param {object} fields
 * @param {string} nextPageName
 * @param {object} [apiResult] present only for navMode 'api'
 */
function fireAnalytics(fields, nextPageName, apiResult) {
  const digitalData = {
    event: 'button_click',
    timestamp: new Date().toISOString(),
    page: { pageName: document.title },
    button: { name: fields.linkText },
    target: { nextPageName: nextPageName || 'no-target' },
    navMode: fields.navMode,
  };
  if (apiResult) digitalData.api = apiResult;
  publish('button:click', digitalData);
}

export default function decorate(block) {
  const fields = readFields(block);
  block.textContent = '';
  block.classList.add('button-block');

  let el;
  if (fields.navMode === 'section') {
    el = document.createElement('a');
    el.href = fields.link ? `#${fields.link}` : '#';
  } else if (fields.navMode === 'api') {
    el = document.createElement('button');
    el.type = 'button';
  } else {
    // 'page' (also the fallback for any unrecognized/legacy navMode value)
    el = document.createElement('a');
    el.href = fields.link || '#';
  }

  el.textContent = fields.linkText;
  if (fields.linkTitle) el.title = fields.linkTitle;
  el.classList.add('button');
  if (fields.linkType) el.classList.add(fields.linkType);

  // Attach the click handler directly on this block's own element rather than
  // relying on the sitewide delegated listener in delayed.js, per the button
  // block's own requirement to trigger analytics itself. stopPropagation()
  // prevents the delegated listener (which still serves plain default-content
  // buttons elsewhere on the site, e.g. teaser/hero CTAs) from double-firing
  // for this element.
  el.addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      if (fields.navMode === 'section') {
        event.preventDefault();
        document.getElementById(fields.link)?.scrollIntoView({ behavior: 'smooth' });
        fireAnalytics(fields, fields.link);
      } else if (fields.navMode === 'api') {
        const result = await callApi(fields.link, { method: 'GET' });
        fireAnalytics(fields, fields.apiSuccessPage || 'no-target', {
          url: fields.link,
          method: 'GET',
          status: result.status,
          ok: result.ok,
          error: result.error,
        });
        if (result.ok && fields.apiSuccessPage) {
          window.location.href = fields.apiSuccessPage;
        }
      } else {
        fireAnalytics(fields, fields.linkText);
      }
    } catch {
      // graceful degradation: analytics/API-call failures must never block
      // the button's own navigation behavior
    }
  });

  block.append(el);
}
