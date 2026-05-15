/**
 * Extracts visible form fields from a Workday application page.
 * @param {boolean} includeFilled If true, returns all fields regardless of if they have values.
 */
export function extractFields(includeFilled = false) {
  const fields = [];
  const seenRadioGroups = new Set();
  const seenElements = new WeakSet();
  const controlSelector = [
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="combobox"]',
    '[role="textbox"]',
    '[role="radio"]',
    '[role="checkbox"]',
    '[contenteditable="true"]'
  ].join(',');

  addResumeFileInputs();

  
  
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

    addFieldFromControl(input, label);
  });

  const formFields = document.querySelectorAll([
    '[data-automation-id="formField"]',
    '[data-automation-id*="formField" i]',
    '[data-automation-id*="question" i]',
    '[data-automation-id*="required" i]',
    '[role="group"]',
    '[role="radiogroup"]',
    'fieldset',
    '[aria-required="true"]',
    '[aria-invalid="true"]'
  ].join(','));
  formFields.forEach(container => {
    const input = findInputInContainer(container);
    if (!input || seenElements.has(input)) return;

    addFieldFromControl(input, container);
  });

  document.querySelectorAll(controlSelector).forEach(control => {
    if (seenElements.has(control)) return;
    addFieldFromControl(control, control);
  });

  return fields;

  function addResumeFileInputs() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      if (seenElements.has(input) || input.dataset.aiFilled) return;

      const container = getFieldContainer(input, input);
      const labelText = getBestLabelText(input, container) || getFileInputLabel(input);

      if (!isResumeUploadLabel(labelText, input)) return;
      if (!includeFilled && hasExistingValue(input, 'file')) return;

      seenElements.add(input);
      fields.push({
        label: labelText || 'Resume/CV',
        type: 'file',
        element: input,
        required: isRequired(input, container) || isResumeUploadLabel(labelText, input),
        options: []
      });
    });
  }

  function addFieldFromControl(input, contextElement) {
    if (!input || seenElements.has(input) || isIgnoredControl(input)) return;

    seenElements.add(input);
    const type = determineFieldType(input);
    const fieldContainer = getFieldContainer(input, contextElement);
    const labelText = getBestLabelText(input, fieldContainer);

    if (type === 'radio') {
      const radioField = buildRadioGroupField(input, labelText);
      if (!radioField || seenRadioGroups.has(radioField.groupKey)) return;
      seenRadioGroups.add(radioField.groupKey);

      if (radioField.label && !radioField.element.dataset.aiFilled) {
        if (includeFilled || !hasExistingValue(radioField.element, type, radioField)) {
          fields.push(radioField);
        }
      }
      return;
    }

    if (labelText && !input.dataset.aiFilled) {
      if (includeFilled || !hasExistingValue(input, type)) {
        fields.push({
            label: labelText,
            type,
            element: input,
          required: isRequired(input, fieldContainer),
          options: getFieldOptions(input, type)
        });
      }
    }
  }
}

function findInputInContainer(container) {
  return container.querySelector([
    'input[type="file"]',
    'input:not([type="hidden"]):is([required], [aria-required="true"], [aria-invalid="true"])',
    'select:is([required], [aria-required="true"], [aria-invalid="true"])',
    'textarea:is([required], [aria-required="true"], [aria-invalid="true"])',
    '[role="combobox"]:is([aria-required="true"], [aria-invalid="true"])',
    '[role="textbox"]:is([aria-required="true"], [aria-invalid="true"])',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="combobox"]',
    '[role="textbox"]',
    '[role="radio"]',
    '[role="checkbox"]'
  ].join(','));
}

function getFileInputLabel(input) {
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id)?.innerText?.trim())
      .filter(Boolean)
      .join(' ');
    if (text) return cleanLabel(text);
  }

  const ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel) return cleanLabel(ariaLabel);

  const id = input.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.innerText?.trim()) return cleanLabel(label.innerText);
  }

  const container = input.closest('[data-automation-id*="resume" i], [data-automation-id*="cv" i], [data-automation-id*="file" i], section, div');
  return cleanLabel(container?.innerText || '');
}

function isResumeUploadLabel(label, input) {
  const text = [
    label,
    input?.getAttribute?.('name'),
    input?.getAttribute?.('id'),
    input?.getAttribute?.('accept'),
    input?.closest?.('[data-automation-id]')?.getAttribute?.('data-automation-id')
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    text.includes('resume') ||
    text.includes('cv') ||
    text.includes('curriculum vitae') ||
    text.includes('.pdf') ||
    text.includes('.doc') ||
    text.includes('file')
  );
}

function buildRadioGroupField(input, fallbackLabel) {
  const name = input.getAttribute('name');
  const group = getRadioGroupContainer(input);
  const radios = Array.from(
  name
    ? document.querySelectorAll(`
        input[type="radio"][name="${CSS.escape(name)}"],
        [role="radio"][name="${CSS.escape(name)}"]
      `)
    : group.querySelectorAll(`
        input[type="radio"],
        [role="radio"]
      `)
).filter(radio =>
  isVisible(radio) ||
  getOptionLabel(radio)
);

  if (radios.length === 0) return null;

  const groupLabel = getRadioGroupLabel(group, input, fallbackLabel);
  const options = radios.map(radio => ({
    element: radio,
    label: getOptionLabel(radio),
    value: radio.value || getOptionLabel(radio)
  }));

  return {
    label: groupLabel,
    type: 'radio',
    element: radios[0],
    options,
    groupKey: name || groupLabel || radios.map(r => r.id || r.value).join('|'),
    required: radios.some(radio => radio.required || radio.getAttribute('aria-required') === 'true') || hasRequiredMarker(group) || hasRequiredMarker(group?.parentElement)
  };
}

function getRadioGroupLabel(group, input, fallbackLabel) {
  const requiredText = findRequiredQuestionText(group) || findRequiredQuestionText(group?.parentElement);
  if (requiredText) return requiredText;

  const legend = group?.querySelector?.('legend');
  if (legend?.innerText?.trim()) return legend.innerText.trim();

  const labelledBy = group?.getAttribute?.('aria-labelledby') || input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id)?.innerText?.trim())
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  const fieldLabel = Array.from(group?.querySelectorAll?.('label') || [])
    .map(label => label.innerText.trim())
    .find(text => text && text !== fallbackLabel);

  return fieldLabel || input.getAttribute('aria-label') || fallbackLabel;
}

function getOptionLabel(input) {
  const labelledBy = input.getAttribute?.('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id)?.innerText?.trim())
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  const id = input.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.innerText?.trim()) return label.innerText.trim();
  }

  const wrappingLabel = input.closest('label');
  if (wrappingLabel?.innerText?.trim()) return wrappingLabel.innerText.trim();

  return input.getAttribute?.('aria-label') || input.innerText?.trim() || input.value || '';
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
  
  const role = element.getAttribute('role');
  if (role === 'combobox') return 'dropdown';
  if (role === 'textbox') return 'text';
  if (role === 'radio') return 'radio';
  if (role === 'checkbox') return 'checkbox';
  
  
  return 'unknown';
}

function getBestLabelText(input, contextElement) {
  const container = getFieldContainer(input, contextElement);

  const labelledBy = input.getAttribute('aria-labelledby') || contextElement?.getAttribute?.('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map(id => document.getElementById(id)?.innerText?.trim())
      .filter(Boolean)
      .join(' ');
    const label = cleanLabel(text);
    if (label && !isGenericControlLabel(label)) return label;
  }

  const ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel) {
    const label = cleanLabel(ariaLabel);
    if (label && !isGenericControlLabel(label)) return label;
  }

  const id = input.id;
  if (id) {
    const explicitLabel = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const label = cleanLabel(explicitLabel?.innerText || '');
    if (label && !isGenericControlLabel(label)) return label;
  }

  const nearbyLabel = container?.querySelector?.('label, legend, [data-automation-id*="label" i], [id*="label" i]');
  const label = cleanLabel(nearbyLabel?.innerText || '');
  if (label && !isGenericControlLabel(label)) return label;

  const requiredText = findRequiredQuestionText(container);
  if (requiredText) return requiredText;

  return extractQuestionTextFromContainer(container, input);
}

function cleanLabel(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '')
    .trim();
}

function isGenericControlLabel(label) {
  const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();
  return [
    '',
    'please select one',
    'select one',
    'select',
    'search',
    'choose',
    'please select',
    'required'
  ].includes(normalized);
}

function extractQuestionTextFromContainer(container, input) {
  if (!container) return '';

  const clone = container.cloneNode(true);
  clone.querySelectorAll('input, select, textarea, button, [role="combobox"], [role="listbox"], [role="option"], svg').forEach(node => node.remove());

  const lines = cleanLabel(clone.innerText)
    .split(/(?<=[?.])\s+|\n+/)
    .map(line => cleanLabel(line))
    .filter(line => line && !isGenericControlLabel(line));

  const question = lines.find(line => line.includes('?')) || lines[0] || '';
  if (question) return question;

  const parent = container.parentElement;
  if (parent && parent !== document.body) {
    return extractQuestionTextFromContainer(parent, input);
  }

  return '';
}

function isRequired(input, contextElement) {
  const container = getFieldContainer(input, contextElement);

  return Boolean(
    input.hasAttribute('required') ||
    input.getAttribute('required') !== null ||
    input.getAttribute('aria-required') === 'true' ||
    input.getAttribute('aria-invalid') === 'true' ||

    container?.querySelector?.(
      '[required], [aria-required="true"], [aria-invalid="true"]'
    ) ||

    hasOwnRequiredMarker(container) ||

    /\brequired\b/i.test(container?.innerText || '')
  );
}

function hasExistingValue(element, type, field = null) {
  if (type === 'file') {
    return Boolean(element.files && element.files.length > 0);
  }

  // Radio / Checkbox
  if (type === 'checkbox' || type === 'radio') {

    // Radio group handling
    if (type === 'radio' && field?.options) {
      return field.options.some(option =>
        isChecked(option.element)
      );
    }

    return isChecked(element);
  }

  // Dropdown / Combobox
  if (type === 'dropdown') {

    // Native select
    if (element.tagName === 'SELECT') {
      return Boolean(
        element.value &&
        element.value.trim() !== '' &&
        element.selectedIndex > 0
      );
    }

    // Workday combobox / custom dropdown
    const text = String(
      element.innerText ||
      element.textContent ||
      element.value ||
      ''
    )
      .trim()
      .toLowerCase();

    return Boolean(
      text &&
      text !== 'select one' &&
      text !== 'search' &&
      text !== 'choose' &&
      text !== 'please select' &&
      text !== 'no response'
    );
  }

  // Text / textarea
  return Boolean(
    element.value &&
    String(element.value).trim() !== ''
  );
}

function hasRequiredMarker(element) {
  return Boolean(
    hasOwnRequiredMarker(element) ||

    /\brequired\b/i.test(
      element?.innerText || ''
    ) ||

    element?.querySelector?.(
      '[aria-required="true"], [required], [aria-invalid="true"]'
    )
  );
}

function getFieldContainer(input, contextElement) {
  const direct = input?.closest?.([
    '[data-automation-id*="formField" i]',
    '[data-automation-id*="question" i]',
    '[role="radiogroup"]',
    '[role="group"]',
    'fieldset'
  ].join(','));
  if (direct) return direct;

  let node = contextElement || input?.parentElement;
  let depth = 0;
  while (node && node !== document.body && depth < 5) {
    const controls = node.querySelectorAll?.('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="radio"], [role="checkbox"]') || [];
    const text = node.innerText || '';
    if (controls.length > 0 && (text.includes('?') || text.includes('*') || /\brequired\b/i.test(text))) {
      return node;
    }
    node = node.parentElement;
    depth++;
  }

  return contextElement || input?.parentElement || input;
}

function getRadioGroupContainer(input) {
  const direct = input.closest('fieldset, [role="radiogroup"], [data-automation-id*="formField" i], [data-automation-id*="question" i]');
  if (direct && findRequiredQuestionText(direct)) return direct;

  let node = direct || input.parentElement;
  let depth = 0;
  while (node && node !== document.body && depth < 5) {
    const radios = node.querySelectorAll?.('input[type="radio"], [role="radio"]') || [];
    const text = node.innerText || '';
    if (radios.length >= 2 && (text.includes('?') || text.includes('*'))) {
      return node;
    }
    node = node.parentElement;
    depth++;
  }

  return direct || input.parentElement;
}

function hasOwnRequiredMarker(element) {
  if (!element) return false;

  const directText = Array.from(element.childNodes || [])
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent || '')
    .join(' ');

  if (/\*/.test(directText)) return true;

  return Array.from(element.children || []).some(child => {
    if (child.matches?.('input, select, textarea, [role="combobox"], [role="radio"], [role="checkbox"], [role="option"], button')) {
      return false;
    }

    const text = child.innerText || child.textContent || '';
    return text.length < 300 && /\*/.test(text);
  });
}

function getFieldOptions(element, type) {

  // Native select dropdown
  if (
    type === 'dropdown' &&
    element.tagName === 'SELECT'
  ) {
    return Array.from(element.options)
      .map(option => option.text?.trim())
      .filter(Boolean)
      .filter(text =>
        !isGenericControlLabel(text)
      );
  }

  // Workday custom combobox
  if (type === 'dropdown') {

    const controls =
      element.getAttribute('aria-controls') ||
      element.getAttribute('aria-owns');

    const listbox = controls
      ? document.getElementById(controls)
      : null;

    if (listbox) {

      return Array.from(
        listbox.querySelectorAll('[role="option"]')
      )
        .map(option =>
          cleanLabel(
            option.innerText ||
            option.textContent ||
            ''
          )
        )
        .filter(Boolean)
        .filter(text =>
          !isGenericControlLabel(text)
        );
    }

    // fallback: visible options in DOM
    const visibleOptions = Array.from(
      document.querySelectorAll('[role="option"]')
    )
      .filter(option => {
        const rect =
          option.getBoundingClientRect();

        return (
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map(option =>
        cleanLabel(
          option.innerText ||
          option.textContent ||
          ''
        )
      )
      .filter(Boolean)
      .filter(text =>
        !isGenericControlLabel(text)
      );

    if (visibleOptions.length > 0) {
      return [...new Set(visibleOptions)];
    }
  }

  return [];
}

function findRequiredQuestionText(container) {
  if (!container) return '';

  const candidates = Array.from(container.querySelectorAll('legend, [role="heading"], [data-automation-id*="label" i], [id*="label" i], p, span, div'))
    .map(element => cleanLabel(element.innerText || element.textContent || ''))
    .filter(text => text && !isGenericControlLabel(text))
    .filter(text => text.length < 250)
    .filter(text => text.includes('*') || text.includes('?') || text.toLowerCase().includes('required'));

  return cleanLabel(candidates.find(text => text.includes('?')) || candidates[0] || '');
}

function isChecked(element) {
  return element.checked || element.getAttribute?.('aria-checked') === 'true';
}

function isIgnoredControl(element) {
  const type = element.getAttribute('type');
  return type === 'hidden' || element.disabled || element.getAttribute('aria-disabled') === 'true';
}

function isVisible(element) {
  if (!element || element.closest('[hidden], [aria-hidden="true"]')) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}
