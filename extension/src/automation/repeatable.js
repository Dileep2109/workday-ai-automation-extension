import { logInfo, logWarn } from '../utils/logger.js';
import { waitForDOMStable } from './domController.js';
import { extractFields } from './extractor.js';
import { fillField } from './filler.js';

const processedRepeatablePages = new Set();

/**
 * Dynamically finds 'Add' buttons for Education and Experience
 * and clicks them to create enough sections for the resume data.
 */
export async function handleRepeatableSections(resumeData) {
  if (!resumeData) return;

  const currentType = getCurrentRepeatablePageType();
  if (currentType === 'experience' || hasExplicitAddButton('experience')) {
    await handleSection('experience', resumeData.experience || []);
  }

  if (currentType === 'education' || hasExplicitAddButton('education')) {
    await handleSection('education', resumeData.education || []);
  }
}

async function handleSection(type, dataArray) {
  const entries = getValidEntries(type, dataArray);
  if (!entries.length) return;

  const pageKey = getStableRepeatablePageKey(type);
  if (processedRepeatablePages.has(pageKey)) {
    logInfo(`Skipping ${type}; this page was already handled.`);
    return;
  }

  let buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  
  // Look for "Add Experience", "Add Education", "Add Work Experience", etc.
  let addBtn = findAddButton(buttons, type);
  const currentType = getCurrentRepeatablePageType();
  const hasExplicitAdd = Boolean(addBtn && isExplicitAddForType(addBtn, type));

  if (currentType !== type && !hasExplicitAdd) return;

  if (addBtn) {
    logInfo(`Found '${addBtn.innerText}' button. Preparing ${entries.length} ${type} entr${entries.length === 1 ? 'y' : 'ies'}.`);
  }

  processedRepeatablePages.add(pageKey);

  let addClicks = 0;
  const maxAddClicks = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let fieldGroup = findNextUnfilledFieldGroup(type);

    if (!fieldGroup) {
      if (!addBtn) {
        if (i === 0) logWarn(`No rendered ${type} fields or Add button found on this page.`);
        break;
      }

      if (addClicks >= maxAddClicks) {
        logWarn(`Reached ${type} Add limit (${maxAddClicks}). Stopping to avoid blank duplicate sections.`);
        break;
      }

      logInfo(`Clicking '${addBtn.innerText}' for ${type} entry ${i + 1}.`);
      const beforeCount = getRepeatableFieldCount(type);
      addBtn.click();
      addClicks++;
      await waitForNewRepeatableFields(type, beforeCount);
      buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      addBtn = findAddButton(buttons, type) || addBtn;
      fieldGroup = findNextUnfilledFieldGroup(type);

      if (!fieldGroup) {
        logWarn(`Opened ${type} section but could not detect fillable fields. Stopping Add clicks.`);
        break;
      }
    }

    if (!fieldGroup || fieldGroup.length === 0) {
      logWarn(`Could not find rendered ${type} fields for entry ${i + 1}.`);
      continue;
    }

    await fillRepeatableEntry(type, fieldGroup, entry, i);
  }
}

function findAddButton(buttons, type) {
  const aliases = type === 'experience'
    ? ['experience', 'work', 'employment', 'job', 'position']
    : ['education', 'school', 'degree'];

  return buttons.find(btn => {
    const text = normalize(btn.innerText || btn.getAttribute('aria-label') || '');
    if (!text.includes('add')) return false;
    const namedForType = aliases.some(alias => text.includes(alias));
    const genericAdd = text === 'add' || text === 'add another' || text.includes('add another');
    return namedForType || (genericAdd && getCurrentRepeatablePageType() === type);
  });
}

function hasExplicitAddButton(type) {
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  return buttons.some(btn => isExplicitAddForType(btn, type));
}

function isExplicitAddForType(button, type) {
  const text = normalize(button.innerText || button.getAttribute('aria-label') || '');
  if (!text.includes('add')) return false;

  const aliases = type === 'experience'
    ? ['experience', 'work experience', 'employment', 'job', 'position']
    : ['education', 'school', 'degree'];

  return aliases.some(alias => text.includes(alias));
}

function getCurrentRepeatablePageType() {
  const headingText = normalize(
    Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
      .map(el => el.innerText)
      .join(' ')
  );

  if (['experience', 'work history', 'employment'].some(alias => headingText.includes(alias))) {
    return 'experience';
  }

  if (['education', 'school', 'degree'].some(alias => headingText.includes(alias))) {
    return 'education';
  }

  const bodyText = normalize(document.body.innerText).slice(0, 12000);
  const experienceSignals = ['add experience', 'add work experience', 'work experience', 'job title', 'company'];
  const educationSignals = ['add education', 'school name', 'degree', 'field of study'];

  const experienceScore = experienceSignals.filter(signal => bodyText.includes(signal)).length;
  const educationScore = educationSignals.filter(signal => bodyText.includes(signal)).length;

  if (experienceScore > educationScore && experienceScore >= 2) return 'experience';
  if (educationScore > experienceScore && educationScore >= 2) return 'education';

  return null;
}

function getStableRepeatablePageKey(type) {
  const headingText = normalize(
    Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
      .map(el => el.innerText)
      .find(Boolean) || ''
  );
  return `${location.pathname}${location.search}::${headingText}::${type}`;
}

function getValidEntries(type, dataArray) {
  const entries = Array.isArray(dataArray) ? dataArray : [];
  return entries.filter(entry => {
    if (!entry || typeof entry !== 'object') return false;
    if (type === 'experience') return Boolean(entry.company || entry.title || entry.description);
    return Boolean(entry.school || entry.degree || entry.major);
  });
}

async function fillRepeatableEntry(type, fields, entry, index) {
  let filledCount = 0;
  const dateFieldIndexes = { month: 0, year: 0 };

  for (const field of fields) {
    const value = getEntryValueForField(type, field.label, entry, dateFieldIndexes);
    if (!value) continue;

    logInfo(`Filling ${type} entry ${index + 1}: ${field.label}`);
    await fillField(field, value);
    if (field.element) {
      field.element.dataset.aiFilled = 'true';
      field.element.dataset.aiRepeatableFilled = 'done';
    }
    filledCount++;
  }

  if (filledCount === 0) {
    logWarn(`No matching ${type} subfields were filled for entry ${index + 1}.`);
  }
}

function findNextUnfilledFieldGroup(type) {
  const fields = extractFields(false)
    .filter(field => !field.element?.dataset?.aiRepeatableFilled)
    .filter(field => isRepeatableField(type, field.label));

  if (fields.length === 0) return null;

  const groups = new Map();
  for (const field of fields) {
    const key = getSectionKey(field.element, type);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(field);
  }

  const firstGroup = Array.from(groups.values())
    .filter(group => group.length >= 2 || hasStrongSingleRepeatableField(type, group[0]?.label))
    .sort((a, b) => getDocumentOrder(a[0].element, b[0].element))[0];

  if (firstGroup) {
    for (const field of firstGroup) {
      if (field.element) field.element.dataset.aiRepeatableFilled = 'pending';
    }
  }

  return firstGroup || null;
}

function getRepeatableFieldCount(type) {
  return extractFields(false).filter(field => isRepeatableField(type, field.label)).length;
}

async function waitForNewRepeatableFields(type, previousCount) {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    await waitForDOMStable(2000, 500);
    if (getRepeatableFieldCount(type) > previousCount) return true;
  }
  return false;
}

function getEntryValueForField(type, label, entry, dateFieldIndexes = null) {
  const normalized = normalize(label);

  if (type === 'experience') {
    const genericDatePart = getGenericDatePartValue(normalized, entry, dateFieldIndexes);
    if (genericDatePart) return genericDatePart;

    if (matchesAny(normalized, ['company', 'employer', 'organization'])) return entry.company;
    if (matchesAny(normalized, ['job title', 'position', 'title', 'role'])) return entry.title;
    if (matchesAny(normalized, ['start month'])) return getMonth(entry.startDate);
    if (matchesAny(normalized, ['start year'])) return getYear(entry.startDate);
    if (matchesAny(normalized, ['end month'])) return getMonth(entry.endDate);
    if (matchesAny(normalized, ['end year'])) return getYear(entry.endDate);
    if (matchesAny(normalized, ['start date', 'from'])) return entry.startDate;
    if (matchesAny(normalized, ['end date', 'to'])) return entry.endDate;
    if (matchesAny(normalized, ['description', 'responsibilities', 'summary'])) return entry.description;
    if (matchesAny(normalized, ['location'])) return entry.location;
  }

  if (type === 'education') {
    const genericDatePart = getGenericDatePartValue(normalized, entry, dateFieldIndexes);
    if (genericDatePart) return genericDatePart;

    if (matchesAny(normalized, ['school', 'institution', 'university', 'college'])) return entry.school;
    if (matchesAny(normalized, ['degree'])) return entry.degree;
    if (matchesAny(normalized, ['field of study', 'major', 'discipline'])) return entry.major;
    if (matchesAny(normalized, ['start month'])) return getMonth(entry.startDate);
    if (matchesAny(normalized, ['start year'])) return getYear(entry.startDate);
    if (matchesAny(normalized, ['end month'])) return getMonth(entry.endDate);
    if (matchesAny(normalized, ['end year'])) return getYear(entry.endDate);
    if (matchesAny(normalized, ['start date', 'from'])) return entry.startDate;
    if (matchesAny(normalized, ['end date', 'to'])) return entry.endDate;
  }

  return '';
}

function getGenericDatePartValue(normalized, entry, dateFieldIndexes) {
  if (!dateFieldIndexes) return '';

  if (normalized === 'month') {
    dateFieldIndexes.month += 1;
    if (dateFieldIndexes.month > 1 && isCurrentEndDate(entry.endDate)) return '';
    return getMonth(dateFieldIndexes.month <= 1 ? entry.startDate : entry.endDate);
  }

  if (normalized === 'year') {
    dateFieldIndexes.year += 1;
    if (dateFieldIndexes.year > 1 && isCurrentEndDate(entry.endDate)) return '';
    return getYear(dateFieldIndexes.year <= 1 ? entry.startDate : entry.endDate);
  }

  return '';
}

function isCurrentEndDate(value) {
  const normalized = normalize(value);
  return !normalized || normalized.includes('present') || normalized.includes('current');
}

function isRepeatableField(type, label) {
  const normalized = normalize(label);
  if (type === 'experience') {
    return matchesAny(normalized, [
      'company',
      'employer',
      'organization',
      'job title',
      'position',
      'title',
      'role',
      'start date',
      'start month',
      'start year',
      'end date',
      'end month',
      'end year',
      'description',
      'responsibilities',
      'location'
    ]);
  }

  return matchesAny(normalized, [
    'school',
    'institution',
    'university',
    'college',
    'degree',
    'field of study',
    'major',
    'start date',
    'start month',
    'start year',
    'end date',
    'end month',
    'end year'
  ]);
}

function getSectionKey(element, type) {
  const explicitSection = element.closest([
    '[data-automation-id*="experience" i]',
    '[data-automation-id*="education" i]',
    '[data-automation-id*="workExperience" i]',
    '[data-automation-id*="educationSection" i]',
    '[data-automation-id*="employment" i]',
    '[data-automation-id*="school" i]'
  ].join(','));

  if (explicitSection && explicitSection !== document.body) return explicitSection;

  let node = element.closest('[data-automation-id="formField"], [role="group"], fieldset, section, div');
  while (node && node !== document.body) {
    const fieldsInNode = Array.from(node.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"]'))
      .map(fieldElement => ({ label: getNearbyLabel(fieldElement), element: fieldElement }))
      .filter(field => field.label && isRepeatableField(type, field.label));

    if (fieldsInNode.length >= 2) return node;
    node = node.parentElement;
  }

  return element.closest('[data-automation-id="formField"]')?.parentElement || element.parentElement || element;
}

function getNearbyLabel(element) {
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.innerText?.trim()) return label.innerText.trim();
  }

  const container = element.closest('[data-automation-id="formField"], [role="group"], fieldset, div');
  return container?.querySelector('label, legend, [data-automation-id*="label" i]')?.innerText?.trim() || element.getAttribute('aria-label') || '';
}

function hasStrongSingleRepeatableField(type, label) {
  const normalized = normalize(label);
  if (type === 'experience') return matchesAny(normalized, ['company', 'employer', 'job title']);
  return matchesAny(normalized, ['school', 'institution', 'university', 'degree']);
}

function getDocumentOrder(a, b) {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function matchesAny(normalizedLabel, keywords) {
  return keywords.some(keyword => normalizedLabel.includes(keyword));
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[*:\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getYear(value) {
  const text = String(value || '');
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : text;
}

function getMonth(value) {
  const text = String(value || '').toLowerCase();
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december'
  ];

  const namedMonth = monthNames.find(month => text.includes(month) || text.includes(month.slice(0, 3)));
  if (namedMonth) return namedMonth[0].toUpperCase() + namedMonth.slice(1);

  const numeric = text.match(/\b(0?[1-9]|1[0-2])\b/);
  if (!numeric) return text;

  return monthNames[Number(numeric[1]) - 1].replace(/^\w/, char => char.toUpperCase());
}
