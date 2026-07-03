import { publish } from '../../scripts/analytics.js';
import callApi from '../../scripts/api-client.js';

// Field order matches the single shared 'nav-button' model's field order in
// blocks/nav-button/_nav-button.json exactly - xwalk renders each model field
// as a positional <div><div>value</div></div> (or
// <div><div><a href="...">...</a></div></div> for the aem-content
// apiSuccessPage field), so readFields() reads block.children by index.
//
// All three definitions (Button (Page)/(Section)/(API Call)) share this ONE
// model - mirroring how teaser/teaser-hero/teaser-compact share one model and
// differ only by an extra 'classes' value (page/section/api). This matters
// for more than authoring convenience: the block loader in scripts/aem.js
// derives which JS/CSS file to load from the model id (the first class on
// the rendered block element), NOT the definition id or title. The model id
// must therefore be BOTH globally unique across the site's
// component-models.json AND equal to this block's folder/file name
// (nav-button). It is deliberately not "button": this project already ships
// a separate default-content Button component (models/_button.json, model id
// "button", resourceType core/franklin/components/button/v1/button, used for
// rich-text CTAs) - reusing that id here silently produced two "button"
// entries in the merged component-models.json, which corrupted Universal
// Editor's model resolution SITE-WIDE (not just for this block), breaking
// authoring even on unrelated pages with no nav-button instance on them.
const FIELD_ORDER = ['link', 'linkText', 'linkTitle', 'linkType', 'apiSuccessPage'];

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
 * @param {string} navType
 * @param {string} nextPageName
 * @param {object} [apiResult] present only for navType 'api'
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
  // Variant comes from the extra class xwalk adds per definition (page/section/api),
  // same mechanism as .teaser.hero / .teaser.compact - not from data-aue-model,
  // since all three definitions share the same 'button' model/data-aue-model value.
  const navType = ['page', 'section', 'api'].find((v) => block.classList.contains(v)) || 'page';
  const fields = readFields(block);
  block.textContent = '';
  block.classList.add('button-block');

  let el;
  if (navType === 'section') {
    el = document.createElement('a');
    el.href = fields.link ? `#${fields.link}` : '#';
  } else if (navType === 'api') {
    el = document.createElement('button');
    el.type = 'button';
  } else {
    // 'page' (also the fallback for any unrecognized variant)
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
      if (navType === 'section') {
        event.preventDefault();
        document.getElementById(fields.link)?.scrollIntoView({ behavior: 'smooth' });
        fireAnalytics(fields, navType, fields.link);
      } else if (navType === 'api') {
        event.preventDefault();
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
