// background.js
// Developed by Ayub Ansary - SEO Specialist (https://ayubansary.com)
// Helping businesses grow beyond limitations
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    ['resultsCount','extensionEnabled'],
    (d) => {
      const patch = {};
      if (!d.resultsCount) patch.resultsCount = '100';
      if (typeof d.extensionEnabled === 'undefined') patch.extensionEnabled = true;
      if (Object.keys(patch).length) chrome.storage.sync.set(patch);
    }
  );
});

// Handle export request from popup -> forward to active tab content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'bt-export') {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      const tab = tabs && tabs[0];
      if (!tab) return sendResponse({ok:false, error:'No active tab'});
      chrome.tabs.sendMessage(tab.id, {type:'bt-export'}, res => {
        if (chrome.runtime.lastError) {
          return sendResponse({ok:false, error: chrome.runtime.lastError.message});
        }
        sendResponse(res || {ok:false, error:'No response'});
      });
    });
    return true; // async
  }
});