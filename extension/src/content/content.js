import { extractFields } from '../automation/extractor.js';
import { fillField } from '../automation/filler.js';
import { getHeuristicMapping } from '../automation/mapper.js';
import {
  waitForDOMStable,
  clickNextButton,
  isReviewPage,
  hasValidationErrors,
  collectValidationErrors,
  getPageSignature
} from '../automation/domController.js';
import { handleRepeatableSections } from '../automation/repeatable.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { removeExistingOverlay, showValidationIssuesOverlay } from './uiOverlay.js';

let automationRunning = false;
let sessionValues = {};
let aiMappingCache = {};

console.log('Workday AI Autofill content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_AUTOFILL') {
    if (automationRunning) {
      logWarn('Autofill is already running. Ignoring duplicate request.');
      sendResponse({ status: 'ignored', message: 'Already running' });
      return true;
    }
    automationRunning = true;
    removeExistingOverlay();
    logInfo('Starting multi-step autofill process...');
    startAutofillFlow().then(result => {
      automationRunning = false;
      sendResponse({ status: 'completed', data: result });
    });
    return true; // Keep channel open for async response
  }
});

async function startAutofillFlow() {
  try {
    const stored = await chrome.storage.local.get(['resumeData', 'resumeFile', 'userPreferences']);
    const { resumeData, resumeFile } = stored;
    const userPreferences = stored.userPreferences || {};
    if (!resumeData) {
      logError('No resume data found in storage. Please upload first.');
      return { success: false, message: 'No resume data' };
    }

    const totalResults = {
      filled: [],
      skipped: [],
      unresolved: []
    };

    let stepCount = 0;
    const maxSteps = 10; // Safety limit to prevent infinite loops

    while (!isReviewPage() && stepCount < maxSteps) {
      stepCount++;
      logInfo(`--- Starting Autofill Step ${stepCount} ---`);
      
      // 1. Wait for stable DOM before processing
      await waitForDOMStable(10000, 1000);

      if (isReviewPage()) {
        const missingReviewRequired = collectRequiredNoResponsesFromReview();
        if (missingReviewRequired.length > 0) {
          logWarn(`Required review fields still show No Response: ${missingReviewRequired.join(', ')}`);
          for (const fieldName of missingReviewRequired) {
            totalResults.unresolved.push(fieldName);
          }
          return stopForValidation(totalResults, missingReviewRequired.map(name => `${name} is required.`));
        }

        logInfo("Reached Review/Submit page. Stopping automation.");
        break;
      }

      // 2. Handle repeatable sections (e.g. Add Experience)
      await handleRepeatableSections(resumeData);
      await tryUploadStoredResume(resumeFile, totalResults);

      // 3. Extract fields (ignores existing values and already ai-filled fields)
      const fields = extractFields();
      logInfo(`Detected ${fields.length} unfilled Workday fields on this step.`);

      if (fields.length > 0) {
        const finalMappings = [];
        const fieldsToBatch = [];

        // 4. Process heuristics and User Preferences
        for (const field of fields) {
          const resumeFileMatch = getResumeFileMapping(field, resumeFile);
          const heuristicMatch = resumeFileMatch || getHeuristicMapping(field.label, resumeData, userPreferences, sessionValues);
          const cacheKey = getFieldCacheKey(field);
          
          if (heuristicMatch) {
            logInfo(`Heuristic/Preference match found for ${field.label}`);
            finalMappings.push({ field, mapping: heuristicMatch });
          } else if (aiMappingCache[cacheKey]) {
            logInfo(`Cached AI match found for ${field.label}`);
            finalMappings.push({ field, mapping: aiMappingCache[cacheKey] });
          } else if (!shouldAskAIForField(field)) {
            totalResults.skipped.push({ label: field.label, reason: 'optional ambiguous field skipped' });
          } else {
            fieldsToBatch.push({
              fieldLabel: field.label,
              fieldType: field.type,
              originalField: field
            });
          }
        }

        // 5. Batch API call for remaining ambiguous fields
        if (fieldsToBatch.length > 0) {
          logInfo(`Sending ${fieldsToBatch.length} fields to AI for batch mapping...`);
          const payloadFields = fieldsToBatch.map(f => ({
            fieldLabel: f.fieldLabel,
            fieldType: f.fieldType,
            options: normalizeFieldOptions(f.originalField.options)
          }));

          const batchResponse = await new Promise(resolve => {
            chrome.runtime.sendMessage({
              action: 'API_CALL',
              endpoint: '/map-fields',
              payload: { fields: payloadFields, resumeData }
            }, resolve);
          });

          if (batchResponse && batchResponse.success && batchResponse.data && batchResponse.data.mappings) {
            const aiMappings = batchResponse.data.mappings;
            const remainingBatchFields = [...fieldsToBatch];
            for (const aiMap of aiMappings) {
              const originalIndex = remainingBatchFields.findIndex(f => f.fieldLabel === aiMap.fieldLabel);
              const originalFieldObj = originalIndex >= 0 ? remainingBatchFields.splice(originalIndex, 1)[0] : null;
              if (originalFieldObj) {
                finalMappings.push({
                  field: originalFieldObj.originalField,
                  mapping: { value: aiMap.value, confidence: aiMap.confidence, source: aiMap.source }
                });
                aiMappingCache[getFieldCacheKey(originalFieldObj.originalField)] = {
                  value: aiMap.value,
                  confidence: aiMap.confidence,
                  source: aiMap.source
                };
              }
            }
          } else {
            logError('Failed to get batch AI mapping.');
            for (const f of fieldsToBatch) {
              totalResults.unresolved.push(f.fieldLabel);
            }
          }
        }

        // 6. Gather Unresolved Fields and Fill
        const finalFieldsToFill = [];
        for (const item of finalMappings) {
           finalFieldsToFill.push(item);
        }

        const resolvedLabels = finalMappings.map(m => m.field.label);
        const unresolvedFieldsList = fields.filter(f => !resolvedLabels.includes(f.label));

        if (unresolvedFieldsList.length > 0) {
          logWarn(`Leaving unresolved fields untouched: ${unresolvedFieldsList.map(f=>f.label).join(', ')}`);
          for (const unresolvedField of unresolvedFieldsList) {
            totalResults.unresolved.push(unresolvedField.label);
          }
        }

        for (const item of finalFieldsToFill) {
          const { field, mapping } = item;
          let { value, confidence, source } = mapping;

          if (value === undefined || value === null || value === '') {
            totalResults.unresolved.push(field.label);
            continue;
          }

          if (!field.required && confidence < 0.7) {
            logWarn(`Low confidence (${confidence}) for ${field.label}. Skipping auto-fill. Suggested: ${value}`);
            totalResults.skipped.push({ label: field.label, suggested: value, confidence, source });
            continue;
          }

          if (field.required && confidence < 0.45) {
            logWarn(`Very low confidence (${confidence}) for required field ${field.label}. Skipping auto-fill. Suggested: ${value}`);
            totalResults.skipped.push({ label: field.label, suggested: value, confidence, source });
            continue;
          }

          if (!shouldAutoFillField(field, source, confidence)) {
            logInfo(`Skipping optional non-resume field: ${field.label}`);
            totalResults.skipped.push({ label: field.label, suggested: value, confidence, source });
            continue;
          }

          logInfo(`Filling ${field.label} with: ${value} (Confidence: ${confidence}, Source: ${source})`);
          const filled = await fillField(field, value);
          
          if (filled && field.element) {
             field.element.dataset.aiFilled = "true";
          }
          if (filled) {
            totalResults.filled.push({ label: field.label, value, confidence, source: source || 'heuristic' });
          } else if (field.required) {
            totalResults.unresolved.push(field.label);
          } else {
            totalResults.skipped.push({ label: field.label, suggested: value, confidence, source });
          }
        }
      } else {
        logInfo("No fields to fill on this page.");
      }

      const remainingRequiredFields = extractFields(false).filter(field => field.required);
      if (remainingRequiredFields.length > 0) {
        logWarn(`Required fields may remain before navigation; letting Workday validate: ${remainingRequiredFields.map(f => f.label).join(', ')}`);
        for (const field of remainingRequiredFields) {
          totalResults.unresolved.push(field.label);
        }
      }

      // 7. Navigate Next
      const beforeNavigationSignature = getPageSignature();
      const clicked = await clickNextButton();
      if (!clicked) {
        logInfo("No 'Next' or 'Continue' button found. Stopping multi-step automation.");
        return {
          success: true,
          message: 'Autofill filled this page. No next button was found.',
          results: totalResults
        };
      }
      
      // 8. Validation Handling
      // Workday often renders validation banners asynchronously after the click.
      // Always wait for the DOM to settle before deciding whether navigation succeeded.
      const navigationResult = await waitForNavigationResult(beforeNavigationSignature);

      if (hasValidationErrors()) {
        return stopForValidation(totalResults);
      }

      if (!navigationResult.advanced && !isReviewPage()) {
        logWarn('Navigation did not advance after one click. Stopping to prevent repeated next-clicking.');
        return {
          success: true,
          message: 'Autofill filled this page. Workday did not move to the next step.',
          results: totalResults
        };
      }
    }

    if (isReviewPage()) {
      const missingReviewRequired = collectRequiredNoResponsesFromReview();
      if (missingReviewRequired.length > 0) {
        logWarn(`Required review fields still show No Response: ${missingReviewRequired.join(', ')}`);
        for (const fieldName of missingReviewRequired) {
          totalResults.unresolved.push(fieldName);
        }
        return stopForValidation(totalResults, missingReviewRequired.map(name => `${name} is required.`));
      }
    }
    
    logInfo('Multi-step Autofill phase completed successfully.');
    return { success: true, message: 'Autofill completed.', results: totalResults };
    
  } catch (error) {
    logError('Error during autofill flow: ' + error.message);
    return { success: false, message: error.message };
  }
}

function shouldAutoFillField(field, source, confidence = 0) {
  if (field.required) return true;
  if (['heuristic', 'preference', 'session'].includes(source)) return true;
  if (source === 'ai' && confidence >= 0.85) return true;
  return source === 'ai' && isResumeBackedField(field);
}

function isResumeBackedField(field) {
  const normalized = String(field.label || '').toLowerCase();
  return (
    normalized.includes('skill') ||
    normalized.includes('certification') ||
    normalized.includes('linkedin') ||
    normalized.includes('github') ||
    normalized.includes('portfolio') ||
    normalized.includes('website')
  );
}

function shouldAskAIForField(field) {
  if (field.required) return true;

  const normalized = String(field.label || '').toLowerCase();
  return (
    normalized.includes('linkedin') ||
    normalized.includes('github') ||
    normalized.includes('portfolio') ||
    normalized.includes('website') ||
    normalized.includes('skill') ||
    normalized.includes('certification')
  );
}

function getFieldCacheKey(field) {
  const options = normalizeFieldOptions(field.options).join('|').toLowerCase();
  return [
    String(field.label || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    field.type || '',
    options
  ].join('::');
}

function getResumeFileMapping(field, resumeFile) {
  if (!resumeFile || field.type !== 'file' || !isResumeUploadField(field)) return null;

  return {
    value: resumeFile,
    confidence: 1.0,
    source: 'resume-file'
  };
}

function isResumeUploadField(field) {
  const normalized = String(field.label || '').toLowerCase();
  return (
    normalized.includes('resume') ||
    normalized.includes('cv') ||
    normalized.includes('curriculum vitae')
  );
}

async function tryUploadStoredResume(resumeFile, totalResults) {
  if (!resumeFile?.dataUrl) return;

  const fileFields = extractFields(false).filter(field => field.type === 'file' && isResumeUploadField(field));
  for (const field of fileFields) {
    if (field.element?.dataset?.aiFilled) continue;

    logInfo(`Uploading stored resume into ${field.label}`);
    const filled = await fillField(field, resumeFile);
    if (filled) {
      field.element.dataset.aiFilled = 'true';
      totalResults.filled.push({
        label: field.label,
        value: resumeFile.name,
        confidence: 1.0,
        source: 'resume-file'
      });
    } else {
      totalResults.unresolved.push(field.label);
    }
  }
}

function stopForValidation(totalResults, explicitErrors = null) {
  const errors = explicitErrors || collectValidationErrors();
  logWarn('Validation errors detected. Stopping automation immediately.');
  showValidationIssuesOverlay(errors);
  return { success: false, message: 'Automation stopped on validation errors', results: totalResults };
}

async function waitForNavigationResult(beforeSignature, timeoutMs = 25000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await waitForDOMStable(5000, 800);

    if (hasValidationErrors()) {
      return { advanced: false, validationErrors: true };
    }

    if (isReviewPage()) {
      return { advanced: true, reviewPage: true };
    }

    if (getPageSignature() !== beforeSignature) {
      await waitForDOMStable(10000, 1000);
      return { advanced: true };
    }

    await delay(500);
  }

  return { advanced: false };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeFieldOptions(options = []) {
  return options
    .map(option => {
      if (typeof option === 'string') return option;
      return option?.label || option?.value || '';
    })
    .map(option => String(option).trim())
    .filter(Boolean);
}

function collectRequiredNoResponsesFromReview() {
  const lines = String(document.body?.innerText || '')
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const missing = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('*')) continue;

    const question = line.replace(/\*+/g, '').trim();
    if (!question || isNonQuestionRequiredText(question)) continue;

    const answer = getNextReviewAnswer(lines, i + 1);
    if (answer && answer.toLowerCase() === 'no response') {
      missing.push(question);
    }
  }

  return [...new Set(missing)];
}

function getNextReviewAnswer(lines, startIndex) {
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 4); i++) {
    const line = lines[i];
    if (!line || line.includes('*')) continue;
    return line;
  }
  return '';
}

function isNonQuestionRequiredText(text) {
  const normalized = text.toLowerCase();
  return (
    normalized === 'required' ||
    normalized.includes('indicates required') ||
    normalized.includes('required fields')
  );
}
