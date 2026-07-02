// blocks/teaser/teaser.js
// Authoring table:
// | teaser (hero)             |
// |----------------------------|
// | [image]     | title + description + up to 2 CTAs |
//
// Variants: hero

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * loads and decorates the teaser block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;

  const inner = document.createElement('div');
  inner.className = 'teaser-inner';
  moveInstrumentation(row, inner);

  [...row.querySelectorAll(':scope > div')].forEach((column, colIdx) => {
    column.classList.add(colIdx === 0 ? 'teaser-image' : 'teaser-content');
    inner.append(column);
  });

  const img = inner.querySelector('.teaser-image img');
  if (img) {
    const optimizedPic = createOptimizedPicture(img.src, img.alt || '', false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture')?.replaceWith(optimizedPic);
  }

  block.replaceChildren(inner);
}
