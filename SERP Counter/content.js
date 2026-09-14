// Function to count search results
function countmeSerpMain() {
    var results = document.querySelectorAll('#search .yuRUbf');
    var resultsPerPage = 10; // Google typically shows 10 results per page
    var currentPage = getCurrentPage();
    var startCount = (currentPage - 1) * resultsPerPage + 1;

    chrome.storage.local.get(['numberColor'], function(result) {
        var numberColor = result.numberColor || "#27c93f";
        var countDisplay = startCount;
        for (var i = 0; i < results.length; i++, countDisplay++) {
            var headerElement = results[i].querySelector('a h3');
            if (!headerElement) continue;

            var height = window.getComputedStyle(headerElement).height;
            if (height == "auto" || parseFloat(height) < 20) {
                countDisplay--;
                continue;
            }

            let counter = document.createElement('div');
            counter.className = 'countme-serp-counter';
            counter.innerHTML = `<span style="color: ${numberColor};">${countDisplay}</span><span style="color: ${numberColor};">⇝</span>`;
            results[i].parentNode.parentNode.parentNode.append(counter);
        }
    });
}

function getCurrentPage() {
    var match = location.href.match(/&start=(\d+)/);
    if (match) {
        return Math.floor(parseInt(match[1]) / 10) + 1;
    }
    return 1;
}

// Function to highlight specified domains in search results
function highlightDomains() {
    chrome.storage.local.get(['domains', 'highlightStatuses'], function(result) {
        var domains = result.domains || [];
        var highlightStatuses = result.highlightStatuses || {};

        var results = document.querySelectorAll('.yuRUbf');

        results.forEach(result => {
            var link = result.querySelector('a');
            if (!link) return;
            
            var url = link.href;

            domains.forEach(domain => {
                if (url.includes(domain) && highlightStatuses[domain] !== false) {
                    result.style.backgroundColor = "#ffffcc";
                    result.classList.add('countme-highlighted'); // Add custom class for highlighted elements
                }
            });
        });
    });
}

// Function to count and highlight
function countAndHighlight() {
    // Remove old counters
    document.querySelectorAll('.countme-serp-counter').forEach(el => el.remove());
    countmeSerpMain();
    highlightDomains();
}

// Function to apply color changes to the page
function applyColor() {
    chrome.storage.local.get(['numberColor'], function(result) {
        var numberColor = result.numberColor || "#27c93f";
        var counters = document.querySelectorAll('.countme-serp-counter span');
        counters.forEach(span => {
            span.style.color = numberColor;
        });
    });
}

// Call applyColor when content script initializes
applyColor();

// Track color changes
chrome.storage.onChanged.addListener(function(changes) {
    if (changes.numberColor) {
        applyColor();
    }
});

// Track hash changes and update search results accordingly
var oldHash = location.hash;
window.addEventListener('hashchange', function() {
    setTimeout(countAndHighlight, 750);
    oldHash = location.hash;
});

// Check if the extension is active and apply counting and highlighting
chrome.storage.local.get(['key'], function(result) {
    if (result.key != 'countme-toggle-off') {
        setTimeout(countAndHighlight, 750);
        document.addEventListener("scrollend", countAndHighlight);
    }
});

let currentHighlightedIndex = -1; // Track the index of the current highlighted element

// Add event listener for hotkey to jump to the next highlighted result
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'H') {
        console.log('Hotkey detected!');
        let highlightedElements = document.querySelectorAll('.countme-highlighted');
        if (highlightedElements.length > 0) {
            // Move to the next highlighted element
            currentHighlightedIndex = (currentHighlightedIndex + 1) % highlightedElements.length;
            highlightedElements[currentHighlightedIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.log('No highlighted elements found.');
        }
    }
});
