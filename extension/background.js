// 点击插件图标时打开 Side Panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// 设置 Side Panel 在所有页面可用
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
