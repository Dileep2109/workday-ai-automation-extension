import { logInfo, logError, logWarn } from '../utils/logger.js';
import { waitForElement } from './observer.js';

/**
 * Fills a Workday form field with the mapped value,
 * properly triggering React events.
 */
export async function fillField(field, value) {
  if (
    !field.element ||
    value === undefined ||
    value === null ||
    (field.type !== 'file' && String(value).trim() === '')
  ) {
    return false;
  }

  try {
    if (field.type === 'text' || field.type === 'textarea') {
      await fillText(field.element, value);

    } else if (
      field.type === 'dropdown' ||
      field.type === 'select'
    ) {
      await fillDropdown(field, value);

    } else if (field.type === 'radio') {
      await fillRadio(field, value);

    } else if (field.type === 'checkbox') {
      fillBoolean(field.element, value);
    } else if (field.type === 'file') {
      await fillFileInput(field, value);
    }

    // Verify after fill
    const verified = await verifyFieldFilled(field, value);

    if (!verified) {
      logWarn(`Field verification failed for ${field.label}`);
    }

    return verified;

  } catch (err) {
    logError(`Error filling ${field.label}: ${err.message}`);
    return false;
  }
}

async function fillText(element, value) {
  if (!isTextEditable(element)) return;

  element.scrollIntoView({
    block: 'center',
    inline: 'nearest'
  });

  element.focus();
  element.click();

  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

  const nativeTextAreaValueSetter =
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

  const setter =
    element.tagName === 'TEXTAREA'
      ? nativeTextAreaValueSetter
      : nativeInputValueSetter;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(
    new Event('input', { bubbles: true })
  );

  element.dispatchEvent(
    new Event('change', { bubbles: true })
  );

  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true
    })
  );

  element.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'Tab',
      bubbles: true
    })
  );

  element.blur();

  element.dispatchEvent(
    new Event('blur', { bubbles: true })
  );

  element.dispatchEvent(
    new FocusEvent('focusout', {
      bubbles: true,
      relatedTarget: document.body
    })
  );

  await delay(120);

  clickOutsideField(element);
}

async function fillDropdown(field, value) {
  const { element } = field;

  if (element.tagName === 'SELECT') {
    const options = Array.from(element.options);

    const targetOption = findBestOption(
      options,
      value,
      opt => opt.text
    );

    if (targetOption) {
      element.value = targetOption.value;

      element.dispatchEvent(
        new Event('change', { bubbles: true })
      );
    }

    return;
  }

  const values = shouldTreatAsMultiValue(field, value)
    ? splitMultiValue(value).slice(0, 12)
    : [value];

  for (const item of values) {
    if (shouldTreatAsMultiValue(field, value)) {
      await fillSkillCombobox(element, item);
    } else {
      await fillWorkdayCombobox(element, item);
    }
    await delay(300);
  }
}

async function fillSkillCombobox(element, value) {
  const combobox =
    element.getAttribute('role') === 'combobox'
      ? element
      : element.closest('[role="combobox"]') || element;

  combobox.scrollIntoView({
    block: 'center',
    inline: 'nearest'
  });

  combobox.focus();
  dispatchMouseSequence(combobox);
  combobox.click();
  await delay(200);

  let searchInput = findSearchInput(combobox);
  if (!searchInput && isTextEditable(combobox)) {
    searchInput = combobox;
  }

  if (searchInput) {
    setEditableValue(searchInput, value);
    await delay(500);
  }

  let listbox = await waitForOptionsToLoad(combobox, null, 2500);
  let options = listbox ? getVisibleOptions(listbox) : [];
  let targetOption = findBestOption(
    options,
    value,
    option => option.innerText || option.textContent || ''
  );

  if (targetOption) {
    await clickOptionAndCommit(targetOption, combobox);
    return;
  }

  const target = searchInput || combobox;
  dispatchKeyboard(target, 'ArrowDown');
  await delay(100);
  dispatchKeyboard(target, 'Enter');
  await delay(250);
  dispatchKeyboard(target, 'Enter');
  await delay(150);
  dispatchKeyboard(target, 'Tab');
}

async function fillWorkdayCombobox(element, value) {
  const combobox =
    element.getAttribute('role') === 'combobox'
      ? element
      : element.closest('[role="combobox"]') || element;

  combobox.scrollIntoView({
    block: 'center',
    inline: 'nearest'
  });

  combobox.focus();
  combobox.click();

  dispatchMouseSequence(combobox);

  let listbox = await waitForListboxForCombobox(
    combobox,
    3000
  );

  const searchInput = findSearchInput(combobox);

  if (searchInput) {
    setEditableValue(searchInput, value);
    await delay(350);
    dispatchKeyboard(searchInput, 'ArrowDown');

  } else if (isTextEditable(combobox)) {

    setEditableValue(combobox, value);
    await delay(350);
    dispatchKeyboard(combobox, 'ArrowDown');

  } else {

    combobox.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: String(value)[0] || '',
        bubbles: true
      })
    );
  }

  listbox = await waitForOptionsToLoad(
    combobox,
    listbox,
    5000
  );

  // Retry logic
  if (!listbox) {
    logWarn(
      `Retrying dropdown '${value}' because listbox did not appear.`
    );

    combobox.click();

    await delay(400);

    listbox = await waitForOptionsToLoad(
      combobox,
      null,
      3000
    );

    if (!listbox) {
      logWarn(
        `No Workday listbox appeared for dropdown value '${value}'.`
      );
      return;
    }
  }

  const options = getVisibleOptions(listbox);

  const targetOption = findBestOption(
    options,
    value,
    option => option.innerText || option.textContent || ''
  );

  if (targetOption) {
    await clickOptionAndCommit(targetOption, combobox);
    return;
  }

  const nestedOption = await selectNestedOption(
    combobox,
    listbox,
    value
  );

  if (nestedOption) return;

  if (options.length > 0) {
    logInfo(
      `No strong dropdown match for '${value}'. Selecting first filtered Workday option.`
    );

    await clickOptionAndCommit(options[0], combobox);
    return;
  }

  const commitTarget = searchInput || combobox;
  dispatchKeyboard(commitTarget, 'Enter');
  await delay(150);
  dispatchKeyboard(commitTarget, 'Tab');
}

async function selectNestedOption(combobox, listbox, value) {
  const category = findNestedCategoryOption(
    getVisibleOptions(listbox),
    value
  );

  if (!category) return false;

  await clickOptionAndCommit(
    category,
    combobox,
    false
  );

  await delay(500);

  const nextListbox = await waitForOptionsToLoad(
    combobox,
    null,
    4000
  );

  if (!nextListbox) return false;

  const nextOptions = getVisibleOptions(nextListbox);

  const targetOption = findBestOption(
    nextOptions,
    value,
    option => option.innerText || option.textContent || ''
  );

  if (!targetOption) return false;

  await clickOptionAndCommit(targetOption, combobox);

  return true;
}

async function fillFileInput(field, storedFile) {
  if (!storedFile?.dataUrl || !storedFile?.name) {
    logWarn('No stored resume file data found for upload.');
    return;
  }

  const element = findUploadInput(field.element, field.label);
  if (!element) {
    logWarn(`No real file input found for ${field.label}.`);
    return;
  }

  element.scrollIntoView?.({
    block: 'center',
    inline: 'nearest'
  });

  const file = await storedResumeToFile(storedFile);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  element.files = dataTransfer.files;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));

  await delay(1200);
}

function findNestedCategoryOption(options, value) {
  const target = normalizeForMatch(value);

  const categories = [];

  if (
    target.includes('linkedin') ||
    target.includes('indeed') ||
    target.includes('glassdoor') ||
    target.includes('monster')
  ) {
    categories.push(
      'job board',
      'job boards',
      'career site'
    );
  }

  if (target.includes('referral')) {
    categories.push(
      'referral',
      'employee referral'
    );
  }

  if (
    target.includes('company') ||
    target.includes('website')
  ) {
    categories.push(
      'company website',
      'career site',
      'company career'
    );
  }

  if (categories.length === 0) return null;

  for (const category of categories) {
    const option = findBestOption(
      options,
      category,
      item => item.innerText || item.textContent || ''
    );

    if (option) return option;
  }

  return null;
}

async function clickOptionAndCommit(
  option,
  combobox,
  shouldBlur = true
) {
  option.scrollIntoView({
    block: 'nearest'
  });

  dispatchMouseSequence(option);

  option.click();

  option.dispatchEvent(
    new Event('input', { bubbles: true })
  );

  option.dispatchEvent(
    new Event('change', { bubbles: true })
  );

  const active = document.activeElement && document.activeElement !== document.body
    ? document.activeElement
    : combobox;

  dispatchKeyboard(active, 'Enter');

  if (shouldBlur) {
    await delay(120);

    dispatchKeyboard(active, 'Tab');

    combobox.blur?.();

    combobox.dispatchEvent(
      new Event('blur', { bubbles: true })
    );

    combobox.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body
      })
    );

    clickOutsideField(combobox);
  }
}

async function fillRadio(field, value) {
  const options =
    field.options && field.options.length > 0
      ? field.options
      : [{
          element: field.element,
          label: field.element.value,
          value: field.element.value
        }];

  const target = findBestOption(
    options,
    value,
    option => `${option.label || ''} ${option.value || ''}`
  );

  if (!target) {
    logWarn(
      `No matching radio option found for '${field.label}' with value '${value}'.`
    );
    return;
  }

  const clickable =
    target.element.closest('label') ||
    target.element.closest('[role="radio"]') ||
    target.element;

  dispatchMouseSequence(clickable);

  clickable.click();

  target.element.dispatchEvent(
    new Event('input', { bubbles: true })
  );

  target.element.dispatchEvent(
    new Event('change', { bubbles: true })
  );

  await delay(120);
}

async function verifyFieldFilled(field, expectedValue) {
  await delay(300);

  const element = field.element;

  if (!element) return false;

  // text
  if (
    field.type === 'text' ||
    field.type === 'textarea'
  ) {
    return String(element.value || '')
      .toLowerCase()
      .includes(
        String(expectedValue).toLowerCase()
      );
  }

  // dropdown
  if (
    field.type === 'dropdown' ||
    field.type === 'select'
  ) {
    const text =
      field.element.closest('[data-automation-id*="formField" i], [role="group"], section, div')?.innerText ||
      element.innerText ||
      element.textContent ||
      element.value ||
      '';

    const normalizedText = normalizeForMatch(text);
    const expectedValues = shouldTreatAsMultiValue(field, expectedValue)
      ? splitMultiValue(expectedValue).slice(0, 12)
      : [expectedValue];

    return expectedValues.some(value => {
      const normalizedValue = normalizeForMatch(value);
      return normalizedValue && (
        normalizedText.includes(normalizedValue) ||
        document.body.innerText.toLowerCase().includes(String(value).toLowerCase())
      );
    });
  }

  // radio
  if (field.type === 'radio') {
    const options = field.options && field.options.length > 0
      ? field.options
      : [{ element: field.element, label: field.element.value, value: field.element.value }];

    const target = findBestOption(
      options,
      expectedValue,
      option => `${option.label || ''} ${option.value || ''}`
    );

    return target ? isChecked(target.element) : options.some(option => isChecked(option.element));
  }

  if (field.type === 'file') {
    const uploadInput = findUploadInput(element, field.label);
    return Boolean(uploadInput?.files && uploadInput.files.length > 0);
  }

  return true;
}

function findUploadInput(element, label = '') {
  if (element?.matches?.('input[type="file"]')) return element;

  const container = element?.closest?.('[data-automation-id*="formField" i], [data-automation-id*="resume" i], [data-automation-id*="cv" i], section, div');
  const nearby = container?.querySelector?.('input[type="file"]');
  if (nearby) return nearby;

  const candidates = Array.from(document.querySelectorAll('input[type="file"]'));
  if (candidates.length === 1) return candidates[0];

  const normalizedLabel = normalizeForMatch(label);
  return candidates.find(input => {
    const text = normalizeForMatch([
      input.name,
      input.id,
      input.accept,
      input.getAttribute('aria-label'),
      input.closest('[data-automation-id]')?.getAttribute('data-automation-id'),
      input.closest('section, div')?.innerText
    ].filter(Boolean).join(' '));

    return (
      text.includes('resume') ||
      text.includes('cv') ||
      text.includes('pdf') ||
      text.includes('doc') ||
      (normalizedLabel && text.includes(normalizedLabel))
    );
  }) || candidates[0] || null;
}

async function storedResumeToFile(storedFile) {
  const response = await fetch(storedFile.dataUrl);
  const blob = await response.blob();
  return new File(
    [blob],
    storedFile.name,
    { type: storedFile.type || blob.type || 'application/octet-stream' }
  );
}

function isChecked(element) {
  return element?.checked || element?.getAttribute?.('aria-checked') === 'true';
}

async function waitForListboxForCombobox(
  combobox,
  timeoutMs
) {
  const controls =
    combobox.getAttribute('aria-controls') ||
    combobox.getAttribute('aria-owns');

  if (controls) {
    const controlled =
      document.getElementById(controls);

    if (controlled && isVisible(controlled)) {
      return controlled;
    }
  }

  try {
    return await waitForElement(
      '[role="listbox"]',
      timeoutMs
    );
  } catch (e) {
    return null;
  }
}

async function waitForOptionsToLoad(
  combobox,
  existingListbox,
  timeoutMs
) {
  const start = Date.now();

  let listbox = existingListbox;

  while (Date.now() - start < timeoutMs) {

    if (!listbox || !isVisible(listbox)) {
      listbox = await waitForListboxForCombobox(
        combobox,
        500
      );
    }

    if (
      listbox &&
      getVisibleOptions(listbox).length > 0
    ) {
      await delay(250);

      if (
        getVisibleOptions(listbox).length > 0
      ) {
        return listbox;
      }
    }

    await delay(150);
  }

  return (
    listbox &&
    getVisibleOptions(listbox).length > 0
  )
    ? listbox
    : null;
}

function findSearchInput(combobox) {
  const ownedInput =
    combobox.querySelector?.('input, textarea');

  if (
    ownedInput &&
    isTextEditable(ownedInput)
  ) {
    return ownedInput;
  }

  const active = document.activeElement;

  if (active && isTextEditable(active)) {
    return active;
  }

  const controls =
    combobox.getAttribute('aria-controls') ||
    combobox.getAttribute('aria-owns');

  const controlled = controls
    ? document.getElementById(controls)
    : null;

  return (
    controlled?.querySelector?.(
      'input, textarea'
    ) || null
  );
}

function getVisibleOptions(listbox) {
  return Array.from(
    listbox.querySelectorAll('[role="option"]')
  ).filter(isVisible);
}

function findBestOption(
  options,
  targetValue,
  getText
) {
  const target = normalizeForMatch(targetValue);

  if (!target) return null;

  const scored = options
    .map(option => {
      const text = normalizeForMatch(
        getText(option)
      );

      return {
        option,
        score: getMatchScore(text, target)
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.option || null;
}

function getMatchScore(optionText, targetText) {
  if (!optionText || !targetText) return 0;

  if (optionText === targetText) return 100;

  if (optionText.includes(targetText)) return 80;

  if (targetText.includes(optionText)) return 70;

  const targetTokens =
    targetText.split(' ').filter(Boolean);

  const matchedTokens =
    targetTokens.filter(token =>
      optionText.includes(token)
    );

  if (!matchedTokens.length) return 0;

  return Math.round(
    (matchedTokens.length /
      targetTokens.length) *
      60
  );
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTextEditable(element) {
  return (
    element &&
    (
      element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA'
    )
  );
}

function setEditableValue(element, value) {
  if (!isTextEditable(element)) return;

  element.focus();
  element.click();

  const nativeInputValueSetter =
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

  const nativeTextAreaValueSetter =
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

  const setter =
    element.tagName === 'TEXTAREA'
      ? nativeTextAreaValueSetter
      : nativeInputValueSetter;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(
    new Event('input', { bubbles: true })
  );

  element.dispatchEvent(
    new Event('change', { bubbles: true })
  );
}

function dispatchKeyboard(element, key) {
  const eventBase = {
    key,
    code: key === ' ' ? 'Space' : key,
    bubbles: true,
    cancelable: true
  };

  element.dispatchEvent(new KeyboardEvent('keydown', eventBase));
  element.dispatchEvent(new KeyboardEvent('keypress', eventBase));
  element.dispatchEvent(new KeyboardEvent('keyup', eventBase));
}

function dispatchMouseSequence(element) {
  ['mousedown', 'mouseup'].forEach(type => {
    element.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window
      })
    );
  });
}

function clickOutsideField(element) {
  const target = document.body;

  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: 2,
    clientY: 2
  };

  target.dispatchEvent(
    new MouseEvent('mousedown', eventOptions)
  );

  target.dispatchEvent(
    new MouseEvent('mouseup', eventOptions)
  );

  target.dispatchEvent(
    new MouseEvent('click', eventOptions)
  );

  if (document.activeElement === element) {
    document.activeElement.blur();
  }
}

function isVisible(element) {
  if (
    !element ||
    element.closest('[hidden], [aria-hidden="true"]')
  ) {
    return false;
  }

  const rect =
    element.getBoundingClientRect();

  const style =
    window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

function delay(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

function fillBoolean(element, value) {
  const normalized =
    normalizeForMatch(value);

  const shouldBeChecked =
    value === true ||
    value === 'true' ||
    value === element.value ||
    normalized === 'yes' ||
    normalized === 'true' ||
    normalized === 'agree' ||
    normalized === 'accepted' ||
    normalized === 'checked';

  if (element.checked !== shouldBeChecked) {
    element.click();

    element.dispatchEvent(
      new Event('change', { bubbles: true })
    );
  }
}

function shouldTreatAsMultiValue(
  field,
  value
) {
  const label =
    normalizeForMatch(field.label);

  return (
    label.includes('skill') &&
    splitMultiValue(value).length > 1
  );
}

function splitMultiValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map(v => v.trim())
      .filter(Boolean);
  }

  return String(value || '')
    .split(/[,;\n]+/)
    .map(v => v.trim())
    .filter(Boolean);
}
