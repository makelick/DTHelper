(function () {
  'use strict';
  const KEY = 'dthelperExpanded';

  const checkbox = document.getElementById('expanded');
  if (!checkbox) return;

  chrome.storage.local.get([KEY], function (r) {
    checkbox.checked = r[KEY] !== false;
  });

  checkbox.addEventListener('change', function () {
    chrome.storage.local.set({ [KEY]: checkbox.checked });
  });
})();
