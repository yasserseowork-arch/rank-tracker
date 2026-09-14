document.addEventListener('DOMContentLoaded', function() {
    var checkbox = document.querySelector('.serp');
    var toggleStatus = document.getElementById('toggleStatus');
    var addedDomainsContainer = document.getElementById('addedDomains');
    var colorPicker = document.getElementById('numberColorPicker');

    function updateToggleStatus() {
        toggleStatus.textContent = checkbox.checked ? 'Enabled' : 'Disabled';
    }

    chrome.storage.local.get(['key', 'domains', 'highlightStatuses', 'numberColor'], function(result) {
        checkbox.checked = result.key !== 'countme-toggle-off';
        updateToggleStatus();

        // Display already saved domains
        displayDomains(result.domains, result.highlightStatuses);

        // Set initial color
        colorPicker.value = result.numberColor || "#ffff";
        
    });

    checkbox.addEventListener('change', function() {
        if (checkbox.checked) {
            chrome.storage.local.remove('key', function() {
                console.log('SERP Counter enabled');
            });
        } else {
            chrome.storage.local.set({
                key: 'countme-toggle-off'
            }, function() {
                console.log('SERP Counter disabled');
            });
        }
        updateToggleStatus();
    });

    var domainInput = document.getElementById('domainInput');
    domainInput.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            var domain = domainInput.value.trim();
            if (domain !== '') {
                chrome.storage.local.get(['domains', 'highlightStatuses'], function(result) {
                    var domains = result.domains || [];
                    var highlightStatuses = result.highlightStatuses || {};
                    domains.push(domain);
                    highlightStatuses[domain] = true;
                    chrome.storage.local.set({ domains: domains, highlightStatuses: highlightStatuses }, function() {
                        if (chrome.runtime.lastError) {
                            console.error('Error saving domain:', chrome.runtime.lastError);
                        } else {
                            console.log('Domain saved:', domain);
                            displayDomains(domains, highlightStatuses); // Update displayed domains
                        }
                    });
                });
                domainInput.value = ''; // Clear input after saving
            }
        }
    });

    function displayDomains(domains, highlightStatuses) {
        addedDomainsContainer.innerHTML = '';
        domains.forEach(function(domain) {
            var domainElement = document.createElement('div');
            domainElement.classList.add('added-domain');
            domainElement.innerHTML = `
                <span>${domain}</span>
                <input type="checkbox" class="domain-highlight-toggle" ${highlightStatuses[domain] !== false ? 'checked' : ''}>
                <span class="remove-domain">Remove</span>
            `;
            addedDomainsContainer.appendChild(domainElement);

            var removeButton = domainElement.querySelector('.remove-domain');
            removeButton.addEventListener('click', function() {
                chrome.storage.local.get(['domains', 'highlightStatuses'], function(result) {
                    var updatedDomains = result.domains.filter(function(d) {
                        return d !== domain;
                    });
                    delete result.highlightStatuses[domain];
                    chrome.storage.local.set({ domains: updatedDomains, highlightStatuses: result.highlightStatuses }, function() {
                        if (chrome.runtime.lastError) {
                            console.error('Error removing domain:', chrome.runtime.lastError);
                        } else {
                            console.log('Domain removed:', domain);
                            displayDomains(updatedDomains, result.highlightStatuses); // Update displayed domains after removal
                        }
                    });
                });
            });

            var toggleCheckbox = domainElement.querySelector('.domain-highlight-toggle');
            toggleCheckbox.addEventListener('change', function() {
                chrome.storage.local.get(['highlightStatuses'], function(result) {
                    var highlightStatuses = result.highlightStatuses || {};
                    highlightStatuses[domain] = toggleCheckbox.checked;
                    chrome.storage.local.set({ highlightStatuses: highlightStatuses }, function() {
                        console.log('Highlight status updated for domain:', domain);
                    });
                });
            });
        });
    }

    // Update the color of the number displayed
    colorPicker.addEventListener('input', function() {
        chrome.storage.local.set({ numberColor: colorPicker.value }, function() {
            console.log('Number color updated:', colorPicker.value);
            // Re-apply the highlighting and counting to update the UI
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                chrome.tabs.reload(tabs[0].id);
            });
        });
    });

    chrome.storage.local.get(['numberColor'], function(result) {
        var numberColor = result.numberColor || "#27c93f"; // Default color if not found
        document.getElementById('numberColorPicker').value = numberColor;
    });

    // Listen for changes in the color picker
    document.getElementById('numberColorPicker').addEventListener('input', function(event) {
        var selectedColor = event.target.value;
        chrome.storage.local.set({numberColor: selectedColor});
    });
    
});

