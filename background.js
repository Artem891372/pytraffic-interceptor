// background.js
console.log('background.js: Начало загрузки');

try {
  const connections = {}; // tabId → port
  const wsLogsBuffer = {}; // tabId → массив логов
  const MAX_BUFFER_SIZE = 1000;
  const pingIntervals = {}; // tabId → interval ID для ping

  // Обработка подключения DevTools панели
  chrome.runtime.onConnect.addListener((port) => {
    console.log('background.js: Получен запрос на подключение от:', port.sender);

    // НЕ игнорируем chrome-extension URL — это нормально для DevTools panel
    // console.log('background.js: URL sender:', port.sender.url);

    // Добавляем listener
    console.log('background.js: Добавлен onMessage listener для порта');
    port.onMessage.addListener((msg) => {
      console.log('background.js: Listener triggered! Получено сообщение от DevTools:', JSON.stringify(msg, null, 2));
      
      if (msg.type === 'init') {
        const tabId = msg.tabId;
        if (tabId == null) {
          console.warn('background.js: tabId отсутствует или undefined в init-сообщении:', msg);
          return;
        }
        console.log(`background.js: DevTools подключен для вкладки ${tabId}`);
        connections[tabId] = port;

        // Если есть буфер логов — отправляем сразу
        if (wsLogsBuffer[tabId]) {
          console.log(`background.js: Отправляем буферизированные логи для вкладки ${tabId} (${wsLogsBuffer[tabId].length} элементов)`);
          wsLogsBuffer[tabId].forEach((log) => {
            port.postMessage({ type: 'ws_log', data: log });
          });
          delete wsLogsBuffer[tabId];
        }

        // Ping для поддержания service worker активным в MV3 (каждые 20 сек)
        const pingInterval = setInterval(() => {
          if (port && !port.disconnected) {
            port.postMessage({ type: "pong" });
            console.log(`background.js: Отправлен pong для вкладки ${tabId} (поддержание соединения)`);
          } else {
            clearInterval(pingInterval);
          }
        }, 20000);
        pingIntervals[tabId] = pingInterval;

        // Обработка отключения панели
        port.onDisconnect.addListener(() => {
          clearInterval(pingIntervals[tabId]);
          delete pingIntervals[tabId];
          delete connections[tabId];
          console.log(`background.js: DevTools отключен от вкладки ${tabId}, ping остановлен`);
        });
      } else if (msg.type === 'ping') {
        console.log('background.js: Получен ping от DevTools');
        port.postMessage({ type: "pong" });
      } else {
        console.warn('background.js: Получено неизвестное сообщение:', msg);
      }
    });

    // Обработка отключения порта (если без init)
    port.onDisconnect.addListener(() => {
      console.log('background.js: Порт отключен без init');
    });
  });

  // Получение сообщений из контент-скриптов (WebSocket логи)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('background.js: Получено сообщение:', msg, 'от:', sender);

    if (msg.type === 'ws_log' && sender.tab) {
      const tabId = sender.tab.id;
      const msgData = msg.data;
      console.log(`background.js: Получен ws_log для вкладки ${tabId}:`, msgData);

      // Буферизация логов
      if (!wsLogsBuffer[tabId]) wsLogsBuffer[tabId] = [];
      wsLogsBuffer[tabId].push(msgData);
      if (wsLogsBuffer[tabId].length > MAX_BUFFER_SIZE) wsLogsBuffer[tabId].shift();

      // Пересылаем в DevTools, если порт активен
      const port = connections[tabId];
      if (port) {
        console.log(`background.js: Пересылаем ws_log в DevTools для вкладки ${tabId}:`, msgData);
        port.postMessage({ type: 'ws_log', data: msgData });
      } else {
        console.log(`background.js: Порт для вкладки ${tabId} не активен, буферизуем сообщение. Буфер: ${wsLogsBuffer[tabId].length}`);
      }

      sendResponse({ status: 'success' });
    } else {
      console.warn('background.js: Неподдерживаемый тип сообщения или нет sender.tab:', msg);
      sendResponse({ status: 'error', message: 'Invalid message or no tab' });
    }
    return true;
  });

  // Очистка буфера при закрытии вкладки
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (wsLogsBuffer[tabId]) {
      delete wsLogsBuffer[tabId];
      console.log(`background.js: Очищен буфер ws_log для закрытой вкладки ${tabId}`);
    }
    if (connections[tabId]) {
      delete connections[tabId];
      console.log(`background.js: Удалён порт DevTools для закрытой вкладки ${tabId}`);
    }
    if (pingIntervals[tabId]) {
      clearInterval(pingIntervals[tabId]);
      delete pingIntervals[tabId];
    }
  });

} catch (error) {
  console.error('background.js: Ошибка при инициализации:', error);
}

console.log('background.js: Завершение загрузки');