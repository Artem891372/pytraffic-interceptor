// devtools.js
console.log('devtools.js загружен');
chrome.devtools.panels.create(
  'Traffic Inspector',
  '', // Иконка не указана
  'panel.html',
  function (panel) {
    console.log('Traffic Inspector panel created');
  }
);