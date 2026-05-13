import { waitForElement } from './observer.js';
import { withRetry } from './retry.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Handles navigating to the next step in Workday applications.
 */
export async function navigateNext() {
  logInfo('Attempting to navigate to next step...');
  
  try {
    // Look for standard Workday Next/Save and Continue buttons
    // Often they have specific data-automation-id or aria-label
    const nextButton = await withRetry(async () => {
      const btn = document.querySelector('[data-automation-id="bottom-navigation-next-button"]') ||
                  document.querySelector('button[title="Save and Continue"]') ||
                  document.querySelector('button[title="Next"]');
                  
      if (!btn) throw new Error('Next button not found');
      return btn;
    });

    // Wait slightly to ensure all state is settled before clicking
    await new Promise(res => setTimeout(res, 500));
    
    // Click the button
    nextButton.click();
    logInfo('Clicked Next button. Waiting for page transition...');
    
    // Simple transition detection: wait for a common element that re-renders, 
    // or wait for a specific time. In a robust MVP, we'll wait for URL change or spinner disappear.
    await new Promise(res => setTimeout(res, 3000));
    logInfo('Navigation likely complete.');
    
  } catch (error) {
    logError('Failed to navigate next: ' + error.message);
  }
}
