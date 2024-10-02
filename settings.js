// Populate language dropdown
const targetLangSelect = document.getElementById('targetLang');
const saveAndTranslateButton = document.getElementById('saveAndTranslate');
const statusElement = document.getElementById('status');

for (const [code, name] of Object.entries(countries)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    targetLangSelect.appendChild(option);
}

// Load saved settings
chrome.storage.sync.get('targetLanguage', (data) => {
    if (data.targetLanguage) {
        targetLangSelect.value = data.targetLanguage;
    }
});

function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? 'red' : 'green';
    setTimeout(() => {
        statusElement.textContent = '';
    }, 3000);
}

// Handle save and translate
saveAndTranslateButton.addEventListener('click', () => {
    const targetLang = targetLangSelect.value;
    
    // Disable button and show loading state
    saveAndTranslateButton.disabled = true;
    saveAndTranslateButton.textContent = 'Translating...';
    setStatus('Translating messages...');

    chrome.storage.sync.set({ targetLanguage: targetLang }, () => {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "saveAndTranslate",
                    newLanguage: targetLang
                }, function(response) {
                    // Re-enable button and restore original text
                    saveAndTranslateButton.disabled = false;
                    saveAndTranslateButton.textContent = 'Save & Translate';

                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                        setStatus('Error: Unable to update translations. Please refresh the WhatsApp Web page.', true);
                    } else if (response && response.status === "success") {
                        setStatus('Settings saved and translations updated!');
                    } else {
                        setStatus('Error: Something went wrong. Please try again.', true);
                    }
                });
            } else {
                // Re-enable button and restore original text
                saveAndTranslateButton.disabled = false;
                saveAndTranslateButton.textContent = 'Save & Translate';
                setStatus('Error: No active tab found. Please make sure WhatsApp Web is open.', true);
            }
        });
    });
});