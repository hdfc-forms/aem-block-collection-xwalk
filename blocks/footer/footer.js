import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import getMetadataSheetRow from '../../scripts/metadata-sheet.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // check the /metadata.json sheet for a per-path footer override before
  // falling back to page-level meta tags and hardcoded defaults
  const sheetRow = await getMetadataSheetRow(window.location.pathname);

  // load footer as fragment
  const footerMeta = (sheetRow && sheetRow.footer) || getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
