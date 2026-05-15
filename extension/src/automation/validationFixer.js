import { logInfo, logWarn } from '../utils/logger.js';
import { fillField } from './filler.js';

/**
 * Attempts lightweight formatting fixes on fields that might have validation errors.
 * Returns true if it attempted a fix on at least one field.
 */
export async function attemptLightweightFixes(fields) {
  let fixesApplied = false;

  for (const field of fields) {
    if (!field.element || !field.element.value) continue;
    
    // Only attempt to fix inputs
    if (field.type === 'text' || field.type === 'textarea') {
      const originalValue = field.element.value;
      const labelLower = field.label.toLowerCase();
      let newValue = originalValue;

      // 1. Trim spaces
      newValue = newValue.trim();

      // 2. Phone formatting (remove non-digits if it looks like a phone number)
      if (labelLower.includes('phone') || labelLower.includes('mobile') || labelLower.includes('contact number')) {
        const digitsOnly = newValue.replace(/\D/g, '');
        if (digitsOnly.length >= 10) {
          newValue = digitsOnly; // Workday often expects pure digits or specific formatting, starting with pure digits is safer
        }
      }

      // 3. Date formatting
      if (labelLower.includes('date') || field.type === 'date') {
        // If it's a date that isn't standard, we can try to standardise it, but often Workday expects MM/DD/YYYY
        // For simplicity, we just rely on trim here unless we want to parse it. 
        // A simple attempt: replace dots or dashes with slashes if they typed it wrong
        if (newValue.match(/^\d{2}[\.-]\d{2}[\.-]\d{4}$/)) {
           newValue = newValue.replace(/[\.-]/g, '/');
        }
      }

      if (newValue !== originalValue) {
        logInfo(`Validation Fixer: Formatting field '${field.label}' from '${originalValue}' to '${newValue}'`);
        await fillField(field, newValue);
        fixesApplied = true;
      }
    }
    
    // 4. Dropdown Reselection (sometimes Workday loses state, forcing a re-select helps)
    if (field.type === 'dropdown') {
      const val = field.element.value || field.element.innerText;
      if (val && val !== 'Select One') {
        logInfo(`Validation Fixer: Reselecting dropdown '${field.label}'`);
        await fillField(field, val); // Refills existing value to trigger React events
        fixesApplied = true;
      }
    }
  }

  return fixesApplied;
}
