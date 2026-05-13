/**
 * Utility to wait for an element to appear in the DOM using MutationObserver.
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    // Check if it already exists
    const existingElement = document.querySelector(selector);
    if (existingElement) {
      return resolve(existingElement);
    }

    // Set up observer
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout
    if (timeout > 0) {
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);
    }
  });
}
