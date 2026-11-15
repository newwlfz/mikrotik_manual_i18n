/**
 * Click-to-zoom for content images, matching the official manual.
 *
 * The official pages carry `medium-zoom-image` on every rendered picture:
 * clicking one opens it over a dimmed backdrop, clicking it (or the backdrop,
 * or pressing Escape) restores the page.
 */
import mediumZoom from 'medium-zoom';

let zoom = null;

// The official site enables zoom only inside Hardware Guides; the Docs plugin
// keeps text-sized pictures (no zoom), which is what this selector matches.
const SELECTOR = 'html.plugin-id-hardware .markdown img';

const EXCLUDED = [
  '[src*=".badge"]',
  '[src$="#gh-dark-mode-only"]',
  '[src$="#gh-light-mode-only"]',
  '.complianceMark img',
  '.no-zoom',
  '[data-no-zoom]',
];

function attach() {
  if (typeof document === 'undefined') return;
  // `Array.from`, not spread: the client bundle is compiled for older targets
  // where `[...nodeList]` becomes `[].concat(nodeList)` and yields the NodeList
  // itself instead of its elements.
  const images = Array.from(document.querySelectorAll(SELECTOR)).filter(
    (image) =>
      !EXCLUDED.some((selector) => image.matches(selector)) &&
      !image.closest('a[href]')?.getAttribute('href')?.match(/\.(png|jpe?g|webp|gif|svg)$/i),
  );
  if (!images.length) return;
  zoom?.detach?.();
  zoom = mediumZoom(images, {
    margin: 24,
    // Resolved by CSS so a colour-mode switch also switches the backdrop.
    background: 'var(--zoom-overlay-bg)',
    scrollOffset: 40,
  });
}

export function onRouteDidUpdate() {
  // Images are lazy-loaded, so the elements exist but may still be empty.
  attach();
  requestAnimationFrame(attach);
}
