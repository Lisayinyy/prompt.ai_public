// Open Side Panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Make Side Panel available on all pages
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
