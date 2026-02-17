(function () {
  'use strict';
  const KEY_SHOW_CARD = 'dthelperShowCard';
  const KEY_EXPANDED = 'dthelperExpanded';
  const KEY_DEBUG = 'dthelperDebug';

  const showCardCheckbox = document.getElementById('showCard');
  const expandedCheckbox = document.getElementById('expanded');
  const debugCheckbox = document.getElementById('debugLog');
  const subOption = document.getElementById('subOption');

  if (!showCardCheckbox || !expandedCheckbox || !subOption) return;

  function updateSubOptionState() {
    const showCard = showCardCheckbox.checked;
    subOption.classList.toggle('disabled', !showCard);
    expandedCheckbox.disabled = !showCard;
  }

  chrome.storage.local.get([KEY_SHOW_CARD, KEY_EXPANDED, KEY_DEBUG], function (r) {
    showCardCheckbox.checked = r[KEY_SHOW_CARD] !== false;
    expandedCheckbox.checked = r[KEY_EXPANDED] !== false;
    if (debugCheckbox) debugCheckbox.checked = r[KEY_DEBUG] !== false;
    updateSubOptionState();
  });

  showCardCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ [KEY_SHOW_CARD]: showCardCheckbox.checked });
    updateSubOptionState();
  });

  expandedCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ [KEY_EXPANDED]: expandedCheckbox.checked });
  });

  if (debugCheckbox) {
    debugCheckbox.addEventListener('change', function () {
      chrome.storage.local.set({ [KEY_DEBUG]: debugCheckbox.checked });
    });
  }
})();
