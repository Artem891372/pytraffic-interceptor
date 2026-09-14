// syringe.js
function init() {
  var webBrowser = typeof browser === "undefined" ? chrome : browser;

  // Создаем и подключаем socket-sniffer.js
  var s = document.createElement("script");
  s.src = webBrowser.runtime.getURL("lib/socket-sniffer.js");
  s.onload = function () {
    console.log('socket-sniffer.js успешно загружен');

    document.body.addEventListener(
      'ws_sniff_debug_from',
      (event) => {
        /* console.log('Перехвачено ws_sniff_debug_from:', event);
        console.log('event.detail:', event.detail);
        console.log('Данные:', event.detail?.data ?? 'Нет данных');
        console.log('URL WebSocket:', event.detail?.url ?? 'Нет URL'); */
        chrome.runtime.sendMessage(
          {
            type: 'ws_log',
            data: {
              direction: '←',
              payload: event.detail?.data ?? 'Нет данных',
              url: event.detail?.url ?? 'Нет URL'
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Ошибка отправки ws_log (from):', chrome.runtime.lastError.message);
            } else {
              //console.log('Сообщение ws_log (from) отправлено успешно');
            }
          }
        );
      },
      { capture: true }
    );

    document.body.addEventListener(
      'ws_sniff_debug_to',
      (event) => {
        /* console.log('Перехвачено ws_sniff_debug_to:', event);
        console.log('event.detail:', event.detail);
        console.log('Отправлено:', event.detail?.data ?? 'Нет данных');
        console.log('URL WebSocket:', event.detail?.url ?? 'Нет URL'); */
        chrome.runtime.sendMessage(
          {
            type: 'ws_log',
            data: {
              direction: '→',
              payload: event.detail?.data ?? 'Нет данных',
              url: event.detail?.url ?? 'Нет URL'
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Ошибка отправки ws_log (to):', chrome.runtime.lastError.message);
            } else {
              //console.log('Сообщение ws_log (to) отправлено успешно');
            }
          }
        );
      },
      { capture: true }
    );

    document.body.addEventListener(
      'ws_sniff_debug_open',
      (event) => {
        /* console.log('Перехвачено ws_sniff_debug_open:', event);
        console.log('event.detail:', event.detail);
        console.log('Открытие:', event.detail?.data ?? 'Нет данных');
        console.log('URL WebSocket:', event.detail?.url ?? 'Нет URL'); */
        chrome.runtime.sendMessage(
          {
            type: 'ws_log',
            data: {
              direction: 'open',
              payload: event.detail?.data ?? 'Нет данных',
              url: event.detail?.url ?? 'Нет URL'
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Ошибка отправки ws_log (open):', chrome.runtime.lastError.message);
            } else {
              //console.log('Сообщение ws_log (open) отправлено успешно');
            }
          }
        );
      },
      { capture: true }
    );

    // Тестовое WebSocket-соединение
    const ws = new WebSocket('wss://echo.websocket.org');
    ws.addEventListener('open', () => {
      console.log('Тестовое соединение открыто');
      ws.send('Тестовое сообщение');
    });
    ws.addEventListener('error', (error) => {
      console.error('Ошибка WebSocket:', error);
    });
  };
  s.onerror = function () {
    console.error('Ошибка загрузки socket-sniffer.js');
  };
  (document.head || document.documentElement).appendChild(s);
}

init();