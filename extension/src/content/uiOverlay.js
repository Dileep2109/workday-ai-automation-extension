export function removeExistingOverlay() {
  const existing = document.getElementById('workday-ai-overlay-container');
  if (existing) {
    existing.remove();
  }
}

function injectStyles() {
  if (document.getElementById('workday-ai-overlay-styles')) return;

  const style = document.createElement('style');
  style.id = 'workday-ai-overlay-styles';

  style.textContent = `
    #workday-ai-overlay-container {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 999999;
      padding: 20px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .workday-ai-modal {
      position: relative;
      background: white;
      padding: 20px;
      border-radius: 10px;
      width: 420px;
      height: 360px;
      max-width: 100%;
      max-height: calc(100vh - 40px);
      overflow: hidden;
      box-shadow: 0 4px 18px rgba(0,0,0,0.2);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }

    .workday-ai-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: #f3f4f6;
      color: #555;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    }

    .workday-ai-close:hover {
      background: #e5e7eb;
    }

    .workday-ai-modal h2 {
      margin-top: 0;
      color: #333;
      font-size: 20px;
      margin-bottom: 16px;
      padding-right: 40px;
    }

    .workday-ai-modal p {
      color: #555;
      margin-bottom: 14px;
      line-height: 1.4;
    }

    .workday-ai-field-group {
      margin-bottom: 16px;
    }

    .workday-ai-field-group label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #444;
    }

    .workday-ai-field-group input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-sizing: border-box;
      font-size: 14px;
    }

    .workday-ai-actions {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: auto;
    }

    .workday-ai-btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.2s;
    }

    .workday-ai-btn-primary {
      background: #0073e6;
      color: white;
    }

    .workday-ai-btn-primary:hover {
      background: #005bb5;
    }

    .workday-ai-btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .workday-ai-btn-secondary:hover {
      background: #ccc;
    }

    .workday-ai-error-list {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      padding: 10px 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      color: #9a3412;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .workday-ai-error-list ul {
      margin: 0;
      padding-left: 0;
      list-style: none;
    }

    .workday-ai-error-list li {
      margin-bottom: 6px;
      line-height: 1.35;
      font-size: 13px;
      word-break: break-word;
    }

    /* Scrollbar styling */
    .workday-ai-error-list::-webkit-scrollbar {
      width: 8px;
    }

    .workday-ai-error-list::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }

    .workday-ai-error-list::-webkit-scrollbar-track {
      background: transparent;
    }
  `;

  document.head.appendChild(style);
}

export function showMissingInfoCollector(unresolvedFieldNames) {
  removeExistingOverlay();

  return Promise.resolve({
    action: 'skipped',
    fieldLabel: unresolvedFieldNames?.[0] || '',
    value: ''
  });
}

export function showValidationIssuesOverlay(errors) {
  return new Promise((resolve) => {
    removeExistingOverlay();
    injectStyles();

    const container = document.createElement('div');
    container.id = 'workday-ai-overlay-container';

    const shortErrors = summarizeValidationErrors(errors);

    const errorItems = shortErrors
      .map((e, index) => `<li><strong>${index + 1}.</strong> ${escapeHtml(e)}</li>`)
      .join('');

    container.innerHTML = `
      <div class="workday-ai-modal">

        <button 
          class="workday-ai-close" 
          id="workday-ai-close-btn"
          aria-label="Close"
        >
          x
        </button>

        <h2>Fix Required</h2>

        <p>
          Automation stopped. Fix these items, then run autofill again.
        </p>
        
        ${shortErrors.length > 0 ? `
          <div class="workday-ai-error-list">
            <ul>${errorItems}</ul>
          </div>
        ` : ''}

        <div class="workday-ai-actions">
          <button 
            class="workday-ai-btn workday-ai-btn-primary" 
            id="workday-ai-resume-autofill"
          >
            Resume Autofill
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(container);

    // Resume button
    document
      .getElementById('workday-ai-resume-autofill')
      .addEventListener('click', () => {
        removeExistingOverlay();
        resolve({ action: 'resume' });
      });

    // Close button
    document
      .getElementById('workday-ai-close-btn')
      .addEventListener('click', () => {
        removeExistingOverlay();
        resolve({ action: 'closed' });
      });

    // Close on outside click
    container.addEventListener('click', (event) => {
      if (event.target === container) {
        removeExistingOverlay();
        resolve({ action: 'closed' });
      }
    });
  });
}

function summarizeValidationErrors(errors) {
  const seen = new Set();

  const values = (
    errors && errors.length
      ? errors
      : ['Please review required fields.']
  )
    .map(toShortError)
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

  return values.slice(0, 5);
}

function toShortError(error) {
  const text = String(error || '')
    .replace(/\s+/g, ' ')
    .replace(/^(error|alert):\s*/i, '')
    .trim();

  if (!text) return '';

  const lower = text.toLowerCase();

  if (
    lower.includes('experience') ||
    lower.includes('employment') ||
    lower.includes('work history')
  ) {
    return 'Work experience needs attention.';
  }

  if (
    lower.includes('education') ||
    lower.includes('school') ||
    lower.includes('degree')
  ) {
    return 'Education needs attention.';
  }

  if (lower.includes('required')) {
    const field = text
      .split(':')[0]
      .replace(/\*+/g, '')
      .trim();

    return field && field.length < 50
      ? `${field} is required.`
      : 'Required field is missing.';
  }

  if (lower.includes('invalid')) {
    const field = text
      .split(':')[0]
      .replace(/\*+/g, '')
      .trim();

    return field && field.length < 50
      ? `${field} is invalid.`
      : 'A field has an invalid value.';
  }

  return text.length > 70
    ? `${text.slice(0, 67)}...`
    : text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
