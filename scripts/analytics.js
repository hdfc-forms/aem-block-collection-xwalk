// scripts/analytics.js
const bus = new EventTarget();

/**
 * Publish an event with a detail payload.
 * @param {string} eventName
 * @param {object} detail
 */
export function publish(eventName, detail) {
  bus.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/**
 * Subscribe a callback to a named event.
 * @param {string} eventName
 * @param {(detail: object) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribe(eventName, callback) {
  const handler = (e) => callback(e.detail);
  bus.addEventListener(eventName, handler);
  return () => bus.removeEventListener(eventName, handler);
}
