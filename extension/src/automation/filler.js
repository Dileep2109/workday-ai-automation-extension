import { logInfo, logError } from '../utils/logger.js';
import { waitForElement } from './observer.js';

/**
 * Fills a Workday form field with the mapped value, properly triggering React events.
 */
export async function fillField(field, value) {
  if (!field.element || !value) return;

  try {
    if (field.type === 'text' || field.type === 'textarea') {
      await fillText(field.element, value);
    } else if (field.type === 'dropdown') {
      await fillDropdown(field.element, value);
    } else if (field.type === 'checkbox' || field.type === 'radio') {
      fillBoolean(field.element, value);
    }
  } catch (err) {
    logError(`Error filling ${field.label}: ${err.message}`);
  }
}

async function fillText(element, value) {
  // Focus the element
  element.focus();

  // Get the native React value setter to bypass React's event pooling/overriding
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;
  
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  const setter = element.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  // Dispatch events so React registers the change
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  element.blur();
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

async function fillDropdown(element, value) {
  // Workday dropdowns are often complex custom components rather than standard <select> elements.
  // This logic depends on the specific Workday UI version.
  
  if (element.tagName === 'SELECT') {
    // Standard select element
    const options = Array.from(element.options);
    const targetOption = options.find(opt => opt.text.toLowerCase().includes(value.toLowerCase()));
    
    if (targetOption) {
      element.value = targetOption.value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else {
    // Custom Workday Combobox (React controlled)
    element.focus();
    
    // Simulate clicking to open the dropdown
    element.click();
    
    // Sometimes we need to type to filter
    await fillText(element, value);
    
    // Wait for the dropdown list to appear and click the first matching result
    try {
      const listbox = await waitForElement('[role="listbox"]', 2000);
      if (listbox) {
        const options = Array.from(listbox.querySelectorAll('[role="option"]'));
        const targetOption = options.find(opt => opt.innerText.toLowerCase().includes(value.toLowerCase()));
        
        if (targetOption) {
          targetOption.click();
        } else if (options.length > 0) {
          // If no exact match but options exist after typing, click the first one
          options[0].click();
        }
      }
    } catch (e) {
      logInfo('Dropdown listbox did not appear, might just be a text field now.');
    }
  }
}

function fillBoolean(element, value) {
  // Checkboxes and radio buttons
  // Assuming value is boolean-ish, or matches the element's value
  const shouldBeChecked = value === true || value === 'true' || value === element.value;
  
  if (element.checked !== shouldBeChecked) {
    element.click();
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
