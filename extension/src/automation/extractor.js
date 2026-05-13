/**
 * Extracts visible form fields from a Workday application page.
 */
export function extractFields() {
  const fields = [];
  
  // Workday typically wraps inputs in a form group with a label
  // We can look for data-automation-id="formField" or label elements
  const labels = document.querySelectorAll('label');
  
  labels.forEach(label => {
    // Attempt to find the input associated with this label
    const id = label.getAttribute('for');
    let input = null;
    
    if (id) {
      input = document.getElementById(id);
    } else {
      // Sometimes input is inside label or adjacent
      input = label.querySelector('input, select, textarea');
      if (!input) {
        input = label.parentElement.querySelector('input, select, textarea');
      }
    }
    
    if (!input) {
      // Workday sometimes uses complex custom dropdowns, e.g., divs with role="combobox"
      const combobox = label.parentElement.querySelector('[role="combobox"]');
      if (combobox) {
        input = combobox;
      }
    }

    if (input) {
      const type = determineFieldType(input);
      const labelText = label.innerText.trim() || label.getAttribute('aria-label') || '';
      
      if (labelText) {
        fields.push({
          label: labelText,
          type: type,
          element: input,
          required: label.innerText.includes('*') || input.hasAttribute('required')
        });
      }
    }
  });

  return fields;
}

function determineFieldType(element) {
  if (element.tagName === 'SELECT') return 'dropdown';
  if (element.tagName === 'TEXTAREA') return 'textarea';
  
  if (element.tagName === 'INPUT') {
    const type = element.getAttribute('type');
    if (type === 'radio') return 'radio';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'file') return 'file';
    if (type === 'date') return 'date';
    return 'text'; // standard input text, email, tel, etc.
  }
  
  if (element.getAttribute('role') === 'combobox') return 'dropdown';
  
  return 'unknown';
}
