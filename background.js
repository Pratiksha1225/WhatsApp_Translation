chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkContentScript") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
          if (chrome.runtime.lastError) {
            sendResponse({contentScriptReady: false});
          } else {
            sendResponse({contentScriptReady: true});
          }
        });
      });
      return true;  // Keep the message channel open for the asynchronous response
    } else if (request.action === "sendToContentScript") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, request.message, function(response) {
          sendResponse(response);
        });
      });
      return true;  // Keep the message channel open for the asynchronous response
    }
  });