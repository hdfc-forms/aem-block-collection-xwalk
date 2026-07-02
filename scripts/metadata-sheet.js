// scripts/metadata-sheet.js
// Reads the site's /metadata.json sheet (authored in AEM as a page using the
// "Metadata" template, sling:resourceType core/franklin/components/spreadsheet/v1/spreadsheet)
// and resolves per-path overrides (e.g. header/footer fragment path, page-type)
// by matching the current path against the sheet's `url` column.

let metadataPromise;

function loadMetadataSheet() {
  if (!metadataPromise) {
    metadataPromise = fetch('/metadata.json')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .catch(() => ({ data: [] }));
  }
  return metadataPromise;
}

/**
 * Converts a Bulk-Metadata-style url pattern ('*' = single path segment,
 * '**' = any number of segments) into a RegExp and tests it against a pathname.
 * @param {string} pattern
 * @param {string} pathname
 * @returns {boolean}
 */
function matchesPattern(pattern, pathname) {
  const regexSource = pattern
    .split('**')
    .map((doubleStarPart) => doubleStarPart
      .split('*')
      .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*'))
    .join('.*');
  return new RegExp(`^${regexSource}$`).test(pathname);
}

/**
 * Finds the first /metadata.json row whose `url` pattern matches the given path.
 * Rows are evaluated in authored order (top to bottom), matching the Bulk Metadata
 * convention of "site-wide first, more specific overrides later" being the author's
 * responsibility to order correctly.
 * @param {string} pathname
 * @returns {Promise<object|undefined>} the matched row, or undefined if none matched
 */
export default async function getMetadataSheetRow(pathname) {
  const { data = [] } = await loadMetadataSheet();
  return data.find((row) => row.url && matchesPattern(row.url, pathname));
}
