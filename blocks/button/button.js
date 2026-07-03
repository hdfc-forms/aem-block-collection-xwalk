import { publish } from '../../scripts/analytics.js';
import callApi from '../../scripts/api-client.js';

// Field order matches each model's field order in blocks/button/_button.json
// exactly - xwalk renders each model field as a positional
// <div><div>value</div></div> (or <div><div><a href="...">...</a></div></div>
// for aem-content reference fields), so readFields() reads block.children by
// index rather than by name. Which field list applies is determined by the
// block's data-aue-model attribute (set by xwalk to the definition's model id).
const FIELD_ORDER = {
  'button-page': ['link', 'linkText', 'linkTitle', 'linkType'],
  'button-section': ['link', 'linkText', 'linkTitle', 'linkType'],
  'button-api': ['link', 'linkText', 'linkTitle', 'apiSuccessPage'],
};

function readFields(block, fieldOrder) {
  const values = {};
  [...block.children].forEach((cell, i) => {
    const name = fieldOrder[i];
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
 * @param {string} navType
 * @param {string} nextPageName
 * @param {object} [apiResult] present only for navType 'button-api'
 */
function fireAnalytics(fields, navType, nextPageName, apiResult) {
  const digitalData = {
    event: 'button_click',
    timestamp: new Date().toISOString(),
    page: { pageName: document.title },
    button: { name: fields.linkText },
    target: { nextPageName: nextPageName || 'no-target' },
    navType,
  };
  if (apiResult) digitalData.api = apiResult;
  publish('button:click', digitalData);
}

export default function decorate(block) {
  const navType = block.dataset.aueModel; // 'button-page' | 'button-section' | 'button-api'
  const fields = readFields(block, FIELD_ORDER[navType] || []);
  block.textContent = '';
  block.classList.add('button-block');

  let el;
  if (navType === 'button-section') {
    el = document.createElement('a');
    el.href = fields.link ? `#${fields.link}` : '#';
  } else if (navType === 'button-api') {
    el = document.createElement('button');
    el.type = 'button';
  } else {
    // 'button-page' (also the fallback for any unrecognized model)
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
      if (navType === 'button-section') {
        event.preventDefault();
        document.getElementById(fields.link)?.scrollIntoView({ behavior: 'smooth' });
        fireAnalytics(fields, navType, fields.link);
      } else if (navType === 'button-api') {
        const result = await callApi(fields.link, { method: 'GET' });
        fireAnalytics(fields, navType, fields.apiSuccessPage || 'no-target', {
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
        fireAnalytics(fields, navType, fields.linkText);
      }
    } catch {
      // graceful degradation: analytics/API-call failures must never block
      // the button's own navigation behavior
    }
  });

  block.append(el);
}
