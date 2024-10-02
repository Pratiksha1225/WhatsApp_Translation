let targetLanguage = 'en'; // Default language

// Listen for ping messages to check if the content script is ready
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "ping") {
        sendResponse({status: "ready"});
    }
    return true;
});

function replaceEmailsAndUrls(text) {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    
    let placeholders = [];
    let index = 0;

    // Replace emails
    text = text.replace(emailRegex, (match) => {
        const placeholder = `__EMAIL_${index}__`;
        placeholders.push({ placeholder, original: match });
        index++;
        return placeholder;
    });

    // Replace URLs
    text = text.replace(urlRegex, (match) => {
        const placeholder = `__URL_${index}__`;
        placeholders.push({ placeholder, original: match });
        index++;
        return placeholder;
    });

    return { modifiedText: text, placeholders };
}

function restoreEmailsAndUrls(text, placeholders) {
    placeholders.forEach(({ placeholder, original }) => {
        text = text.replace(placeholder, original);
    });
    return text;
}

function splitText(text, maxLength) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + maxLength;
        if (end >= text.length) {
            chunks.push(text.slice(start));
        } else {
            // Find the last space within the limit
            while (end > start && text[end] !== ' ') {
                end--;
            }
            if (end === start) {
                // If no space found, cut at maxLength
                end = start + maxLength;
            }
            chunks.push(text.slice(start, end));
        }
        start = end + 1; // +1 to skip the space
    }
    return chunks;
}

async function translateText(text, targetLang) {
    const maxLength = 1000;
    const apiKey = "gmGe1wQwhWzImydh3M2HakvhthNReGNZ";
    const apiUrl = `https://api.apilayer.com/language_translation/translate?target=${targetLang}`;

    const myHeaders = new Headers();
    myHeaders.append("apikey", apiKey);

    if (text.length <= maxLength) {
        const requestOptions = {
            method: 'POST',
            redirect: 'follow',
            headers: myHeaders,
            body: text
        };

        try {
            const response = await fetch(apiUrl, requestOptions);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            if (result.translations && result.translations.length > 0) {
                return result.translations[0].translation;
            } else {
                throw new Error('No translation found in the response');
            }
        } catch (error) {
            console.error('Translation error:', error);
            throw error;
        }
    } else {
        const chunks = splitText(text, maxLength);
        const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
            const requestOptions = {
                method: 'POST',
                redirect: 'follow',
                headers: myHeaders,
                body: chunk
            };

            try {
                const response = await fetch(apiUrl, requestOptions);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                if (result.translations && result.translations.length > 0) {
                    return result.translations[0].translation;
                } else {
                    throw new Error('No translation found in the response');
                }
            } catch (error) {
                console.error('Translation error:', error);
                throw error;
            }
        }));

        return translatedChunks.join(' ');
    }
}

async function addTranslation(messageElement) {
    const textElement = messageElement.querySelector('span.selectable-text.copyable-text');
    if (!textElement) return;

    const originalText = textElement.textContent.trim();
    const languageName = countries[targetLanguage] || targetLanguage;

    let translationElement = messageElement.querySelector('.whatsapp-translation');
    if (!translationElement) {
        translationElement = document.createElement('div');
        translationElement.className = 'whatsapp-translation';
        translationElement.style.fontStyle = 'italic';
        translationElement.style.color = '#667781';
        translationElement.style.fontSize = '0.85em';
        translationElement.style.marginTop = '4px';
        translationElement.style.paddingLeft = '4px';
        
        // Find the appropriate container to append the translation
        const containerElement = messageElement.querySelector('div.copyable-text');
        if (containerElement) {
            containerElement.appendChild(translationElement);
        } else {
            messageElement.appendChild(translationElement);
        }
    }

    translationElement.textContent = `Translating to ${languageName}...`;

    try {
        const translatedText = await translateText(originalText, targetLanguage);
        translationElement.textContent = `[${languageName}]: ${translatedText}`;
    } catch (error) {
        console.error('Translation error:', error);
        translationElement.textContent = `Error translating to ${languageName}: ${error.message}`;
    }
}

async function translateAllMessages() {
    const messages = document.querySelectorAll('div.message-in, div.message-out');
    for (const message of messages) {
        await addTranslation(message);
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translateMessages") {
        translateAllMessages().then(() => sendResponse({status: "success"}));
    } else if (request.action === "languageChanged") {
        targetLanguage = request.newLanguage;
        translateAllMessages().then(() => sendResponse({status: "success"}));
    } else if (request.action === "saveAndTranslate") {
        targetLanguage = request.newLanguage;
        translateAllMessages().then(() => {
            sendResponse({status: "success"});
        }).catch((error) => {
            console.error('Translation error:', error);
            sendResponse({status: "error", message: error.message});
        });
        return true; // Keeps the message channel open for the async response
    }
    return true; // Keep the message channel open for asynchronous response
});

// Initial translation when the script loads
chrome.storage.sync.get('targetLanguage', (data) => {
    if (data.targetLanguage) {
        targetLanguage = data.targetLanguage;
    }
    translateAllMessages();
});

// Observer to watch for new messages
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('message-in')) {
                    addTranslation(node);
                }
            });
        }
    });
});

// Start observing the chat container
function startObserver() {
    const chatContainer = document.querySelector('div[data-testid="conversation-panel-messages"]');
    if (chatContainer) {
        observer.observe(chatContainer, { childList: true, subtree: true });
    } else {
        setTimeout(startObserver, 1000); // Retry after 1 second if the container is not found
    }
}

startObserver();

// Add this at the beginning of your script.js file
function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .whatsapp-translation {
            padding-bottom: 16px; /* Add space at the bottom */
        }
        /* Adjust the timestamp positioning */
        .message-in .whatsapp-translation + .copyable-text span[data-testid="msg-meta"],
        .message-out .whatsapp-translation + .copyable-text span[data-testid="msg-meta"] {
            bottom: -4px !important;
        }
    `;
    document.head.appendChild(style);
}

// Call this function when your content script loads
injectCSS();
