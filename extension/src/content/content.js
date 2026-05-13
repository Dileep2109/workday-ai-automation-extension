import { extractFields } from '../automation/extractor.js';
import { fillField } from '../automation/filler.js';
import { getHeuristicMapping } from '../automation/mapper.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

console.log('Workday AI Autofill content script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_AUTOFILL') {
    logInfo('Starting autofill process...');
    startAutofillFlow().then(result => {
      sendResponse({ status: 'completed', data: result });
    });
    return true; // Keep channel open for async response
  }
});

async function startAutofillFlow() {
  try {
    const { resumeData } = await chrome.storage.local.get(['resumeData']);
    if (!resumeData) {
      logError('No resume data found in storage. Please upload first.');
      return { success: false, message: 'No resume data' };
    }

    const fields = extractFields();
    logInfo(`Detected ${fields.length} Workday fields.`);
    
    const results = {
      filled: [],
      skipped: [],
      unresolved: []
    };

    const finalMappings = [];
    const fieldsToBatch = [];

    // 1. Process heuristics locally first
    for (const field of fields) {
      const heuristicMatch = getHeuristicMapping(field.label, resumeData);
      
      if (heuristicMatch) {
        logInfo(`Heuristic match found for ${field.label}`);
        finalMappings.push({
          field: field,
          mapping: heuristicMatch
        });
      } else {
        logInfo(`No heuristic match for ${field.label}. Queuing for AI Batch Mapping...`);
        fieldsToBatch.push({
          fieldLabel: field.label,
          fieldType: field.type,
          originalField: field
        });
      }
    }

    // 2. Batch API call for remaining fields
    if (fieldsToBatch.length > 0) {
      logInfo(`Sending ${fieldsToBatch.length} fields to AI for batch mapping...`);
      
      const payloadFields = fieldsToBatch.map(f => ({
        fieldLabel: f.fieldLabel,
        fieldType: f.fieldType
      }));

      const batchResponse = await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: 'API_CALL',
          endpoint: '/map-fields',
          payload: {
            fields: payloadFields,
            resumeData: resumeData
          }
        }, resolve);
      });

      if (batchResponse && batchResponse.success && batchResponse.data && batchResponse.data.mappings) {
        const aiMappings = batchResponse.data.mappings;
        
        // Merge AI mappings back
        for (const aiMap of aiMappings) {
          // Find the corresponding original field
          const originalFieldObj = fieldsToBatch.find(f => f.fieldLabel === aiMap.fieldLabel);
          if (originalFieldObj) {
            finalMappings.push({
              field: originalFieldObj.originalField,
              mapping: {
                value: aiMap.value,
                confidence: aiMap.confidence,
                source: aiMap.source
              }
            });
          }
        }
      } else {
        logError('Failed to get batch AI mapping.');
        // Mark all batched fields as unresolved if API fails
        for (const f of fieldsToBatch) {
          results.unresolved.push(f.fieldLabel);
        }
      }
    }

    // 3. Fill the fields
    for (const item of finalMappings) {
      const { field, mapping } = item;
      const { value, confidence } = mapping;

      if (!value) {
        results.unresolved.push(field.label);
        continue;
      }

      if (confidence < 0.7) {
        logWarn(`Low confidence (${confidence}) for ${field.label}. Skipping auto-fill. Suggested value: ${value}`);
        results.skipped.push({ label: field.label, suggested: value, confidence });
        continue;
      }

      logInfo(`Filling ${field.label} with: ${value} (Confidence: ${confidence})`);
      await fillField(field, value);
      results.filled.push({ label: field.label, value, confidence });
    }
    
    logInfo('Autofill phase completed for current step.');
    return { success: true, results };
    
  } catch (error) {
    logError('Error during autofill flow: ' + error.message);
    return { success: false, message: error.message };
  }
}
