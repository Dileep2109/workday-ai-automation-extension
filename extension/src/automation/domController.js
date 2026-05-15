import { logInfo, logWarn } from '../utils/logger.js';

/**
 * Waits for the DOM to stop mutating for a given idle time, up to a maximum timeout.
 */
export function waitForDOMStable(timeoutMs = 15000, idleTimeMs = 1500) {
  return new Promise((resolve) => {
    let timeoutId;
    let fallbackId;

    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        observer.disconnect();
        clearTimeout(fallbackId);
        resolve(true);
      }, idleTimeMs);
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    // Initial timeout in case DOM is already stable
    timeoutId = setTimeout(() => {
      observer.disconnect();
      clearTimeout(fallbackId);
      resolve(true);
    }, idleTimeMs);

    // Hard fallback to prevent infinite hanging
    fallbackId = setTimeout(() => {
      observer.disconnect();
      clearTimeout(timeoutId);
      logWarn('DOM stabilization timed out.');
      resolve(false); // Finished by timeout, not idle
    }, timeoutMs);
  });
}

/**
 * Finds and clicks the "Save and Continue", "Next", or "Continue" button.
 */
export async function clickNextButton() {
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  
  const nextBtn = buttons.find(btn => {
    const text = [
      btn.innerText,
      btn.getAttribute('aria-label'),
      btn.getAttribute('title'),
      btn.getAttribute('data-automation-id')
    ].filter(Boolean).join(' ').trim().toLowerCase();

    // Exclude 'save for later'
    if (text.includes('save for later')) return false;
    if (isSubmitButtonText(text)) return false;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

    return (
      text === 'save and continue' ||
      text === 'next' ||
      text === 'continue' ||
      text.includes('save and continue') ||
      text.includes('go to next') ||
      text.includes('next step') ||
      text.includes('continue')
    );
  });

  if (nextBtn) {
    logInfo(`Clicking navigation button: ${nextBtn.innerText}`);
    nextBtn.scrollIntoView({ block: 'center', inline: 'nearest' });
    nextBtn.focus?.();
    ['mousedown', 'mouseup', 'click'].forEach(type => {
      nextBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
    nextBtn.click?.();
    return true;
  }
  return false;
}

export function getPageSignature() {
  const heading = Array.from(document.querySelectorAll('h1, h2'))
    .map(el => el.innerText.trim())
    .find(Boolean) || '';
  const visibleLabels = Array.from(document.querySelectorAll('label'))
    .filter(isVisible)
    .slice(0, 8)
    .map(el => el.innerText.trim())
    .filter(Boolean)
    .join('|');

  return `${location.pathname}${location.search}::${heading}::${visibleLabels}`;
}

/**
 * Checks if the current page is the final Review / Submit page.
 * We want to stop automation here.
 */
export function isReviewPage() {
  const headers = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'));
  const hasReviewHeading = headers.some(h => {
    const text = normalizeText(h.innerText || h.textContent || '').toLowerCase();
    return text.includes('review') || text.includes('submit application');
  });

  return hasReviewHeading || hasSubmitButton();
}

function hasSubmitButton() {
  return Array.from(document.querySelectorAll('button, [role="button"]')).some(button => {
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const text = [
      button.innerText,
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
      button.getAttribute('data-automation-id')
    ].filter(Boolean).join(' ').trim().toLowerCase();
    return isSubmitButtonText(text);
  });
}

function isSubmitButtonText(text) {
  return (
    text === 'submit' ||
    text === 'submit application' ||
    text.includes('submit application') ||
    text.includes('bottom-navigation-submit')
  );
}

/**
 * Checks if the page is currently displaying a validation error banner.
 */
export function hasValidationErrors() {
  return collectValidationErrors().length > 0;
}

export function collectValidationErrors() {
  const selectors = [
    '[role="alert"]',
    '[aria-live="assertive"]',
    '[data-automation-id="pageError"]',
    '[data-automation-id="errorBanner"]',
    '[data-automation-id="fieldError"]',
    '[data-automation-id*="error" i]',
    '[id*="error" i]',
    '.error',
    '.alert-error'
  ];

  const messages = [];
  const seen = new Set();
  const candidates = Array.from(document.querySelectorAll(selectors.join(','))).filter(isVisible);

  for (const element of candidates) {
    const text = getValidationText(element);
    if (!text || seen.has(text)) continue;

    const lower = text.toLowerCase();
    if (
      lower.includes('error') ||
      lower.includes('fix the following') ||
      lower.includes('required') ||
      lower.includes('must be') ||
      lower.includes('invalid') ||
      lower.includes('missing')
    ) {
      seen.add(text);
      messages.push(text);
    }
  }

  return messages;
}

function getValidationText(element) {
  if (element.getAttribute('aria-invalid') === 'true') {
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      const description = describedBy
        .split(/\s+/)
        .map(id => document.getElementById(id)?.innerText?.trim())
        .filter(Boolean)
        .join(' ');
      if (description) return normalizeText(description);
    }

    const label = findNearestLabelText(element);
    return normalizeText(label ? `${label}: required or invalid` : 'A required field is invalid or missing.');
  }

  return normalizeText(element.innerText || element.textContent || '');
}

function findNearestLabelText(element) {
  const id = element.id;
  if (id) {
    const explicitLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (explicitLabel?.innerText?.trim()) return explicitLabel.innerText.trim();
  }

  const container = element.closest('[data-automation-id="formField"], .css-1ud5i8o, div');
  return container?.querySelector('label')?.innerText?.trim() || '';
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function isVisible(element) {
  if (!element || element.closest('[hidden], [aria-hidden="true"]')) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}
