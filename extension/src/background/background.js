// Service worker for Workday extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Workday AI Autofill Extension Installed');
  // Enable side panel on click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
});

// We might need to proxy API calls here to avoid CORS issues from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'API_CALL') {
    fetch(`http://localhost:8000${message.endpoint}`, {
      method: message.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message.payload)
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }
});
