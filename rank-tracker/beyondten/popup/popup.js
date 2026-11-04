// إعدادات عدد نتائج البحث في كل صفحة
// Helping businesses grow beyond limitations

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('resultCount');
  const toggle = document.getElementById('extToggle');
  const statusText = document.getElementById('statusText');
  const applyBtn = document.getElementById('applyNow');

  function setStatus(val) {
    statusText.textContent = `Currently showing ${val} results`;
  }

  chrome.storage.local.get(['resultsCount', 'extensionEnabled'], (d) => {
    const count = d.resultsCount || '100';
    const enabled = d.extensionEnabled !== false;
    select.value = count;
    toggle.checked = enabled;
    setStatus(count);
  });

  applyBtn.addEventListener('click', () => {
    const selected = select.value;
    chrome.storage.local.set({
      resultsCount: selected,
      extensionEnabled: toggle.checked
    }, () => {
      setStatus(selected);
      applyBtn.textContent = "Applied!";

      // Reload the active tab to apply changes immediately
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes("google.")) {
          chrome.tabs.reload(tabs[0].id);
        }
      });

      setTimeout(() => applyBtn.textContent = "Apply Now", 1000);
    });
  });

  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ extensionEnabled: toggle.checked });
  });
});