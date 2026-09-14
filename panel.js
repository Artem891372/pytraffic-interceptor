const searchInput = document.getElementById('search');
const listEl = document.getElementById('list');
const detailsEl = document.getElementById('details');
const tabs = document.querySelectorAll('.tab');
const reloadPageBtn = document.getElementById('reloadPage');

let currentTab = 'http';
let httpLogs = [];
let wsLogs = [];

console.log('panel.js загружен');

const port = chrome.runtime.connect({ name: "devtools" });
const tabId = chrome.devtools.inspectedWindow.tabId;

console.log('panel.js: tabId получен:', tabId, 'Тип:', typeof tabId);

// Отправляем init-сообщение с tabId (как число)
port.postMessage({ type: "init", tabId: Number(tabId) });
console.log('panel.js: Отправлено init-сообщение с tabId:', Number(tabId));

// Повторная отправка init через 1500 мс (увеличено для MV3 задержек)
setTimeout(() => {
  port.postMessage({ type: "init", tabId: Number(tabId) });
  console.log('panel.js: Повторно отправлено init-сообщение с tabId:', Number(tabId));
}, 1500);

// Обработчик входящих сообщений
port.onMessage.addListener((msg) => {
  console.log('panel.js: Получено сообщение:', JSON.stringify(msg, null, 2));
  if (msg.type === 'ws_log' && msg.data) {
    wsLogs.push({
      url: msg.data.url || 'unknown',
      direction: msg.data.direction,
      data: msg.data.payload,
      dataPreview: typeof msg.data.payload === 'string' ? msg.data.payload.slice(0, 80) : '[binary]'
    });
    console.log(`panel.js: Добавлено в wsLogs, всего элементов: ${wsLogs.length}`);
    if (currentTab === 'ws') {
      console.log('panel.js: Обновляем список WebSocket-логов');
      renderList();
    }
  } else {
    console.warn('panel.js: Неподдерживаемый тип сообщения или нет данных:', msg);
  }
});

// Проверяем отключение порта
port.onDisconnect.addListener(() => {
  console.log('panel.js: Порт отключен от background.js');
});

// Ping для поддержания соединения в MV3 (каждые 20 сек)
const pingInterval = setInterval(() => {
  if (port) {
    port.postMessage({ type: "ping" });
    console.log('panel.js: Отправлен ping для поддержания соединения');
  }
}, 20000);

// Остановка ping при отключении
port.onDisconnect.addListener(() => {
  clearInterval(pingInterval);
  console.log('panel.js: Ping остановлен');
});

// Обработчик для кнопки "Reload Page"
reloadPageBtn.addEventListener('click', () => {
  console.log('panel.js: Перезагрузка страницы для вкладки:', tabId);
  chrome.devtools.inspectedWindow.reload();
});

// === Helpers ===
function highlight(text, query) {
  if (!query) return text;
  try {
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(re, '<mark>$1</mark>');
  } catch {
    return text;
  }
}

function matchesSearch(item, q) {
  if (!q) return true;
  q = q.toLowerCase();
  if (currentTab === 'http') {
    return (
      item.url.toLowerCase().includes(q) ||
      (item.requestBody && item.requestBody.toLowerCase().includes(q)) ||
      (item.responseBody && item.responseBody.toLowerCase().includes(q))
    );
  } else {
    return item.dataPreview.toLowerCase().includes(q);
  }
}

function renderList() {
  console.log(`Рендеринг списка для вкладки: ${currentTab}, количество логов: ${wsLogs.length || httpLogs.length}`);
  const q = searchInput.value.trim();
  const logs = currentTab === 'http' ? httpLogs : wsLogs;
  listEl.innerHTML = '';
  logs.forEach((item) => {
    if (!matchesSearch(item, q)) return;
    const div = document.createElement('div');
    div.className = 'item';
    if (currentTab === 'http') {
      const statusColor = item.status >= 500 ? 'red' : item.status >= 400 ? 'orange' : 'green';
      div.innerHTML = `[<span style="color:${statusColor}">${item.status}</span>] ${highlight(
        item.method,
        q
      )} ${highlight(item.url, q)}`;
    } else {
      let dataPreview;
      try {
        dataPreview = JSON.stringify(JSON.parse(item.data), null, 2).slice(0, 80);
      } catch {
        dataPreview = item.data.slice(0, 80);
      }
      div.innerHTML = `[${item.direction}] ${highlight(dataPreview, q)}`;
    }
    div.onclick = () => showDetails(item, q);
    listEl.appendChild(div);
  });
}

function showDetails(item, q) {
  console.log('Отображение деталей для:', item);
  if (currentTab === 'http') {
    const html = `
<b>${highlight(item.method, q)} ${highlight(item.url, q)}</b><br>
Status: ${item.status}
<pre>--- Request Headers ---
${JSON.stringify(item.requestHeaders, null, 2)}

--- Request Body ---
${highlight(item.requestBody || '(empty)', q)}

--- Response Headers ---
${JSON.stringify(item.responseHeaders, null, 2)}

--- Response Body ---
${highlight(item.responseBody || '(empty)', q)}
</pre>
<button id="copyPython" class="copy">Copy as python requests</button>`;
    detailsEl.innerHTML = html;
    document.getElementById('copyPython').addEventListener('click', () => {
      copyToClipboard(generatePythonSnippet(item));
    });
  } else {
    let formattedData;
    try {
      formattedData = JSON.stringify(JSON.parse(item.data), null, 2);
    } catch {
      formattedData = item.data;
    }
    detailsEl.innerHTML = `
<b>${item.url}</b><br>
Direction: ${item.direction}
<pre>${highlight(formattedData, q)}</pre>`;
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function generatePythonSnippet(req) {
  const headers = { ...req.requestHeaders };
  delete headers['content-length'];
  delete headers['host'];
  delete headers['accept-encoding'];
  const headerPairs = Object.entries(headers).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const headersBlock = `headers = {\n${headerPairs.join(',\n')}\n}`;
  let bodySnippet = '';
  if (req.requestBody) {
    if ((headers['Content-Type'] || '').includes('application/json')) {
      try {
        const parsed = JSON.parse(req.requestBody);
        bodySnippet = `json=${JSON.stringify(parsed, null, 2)}`;
      } catch {
        bodySnippet = `data=${JSON.stringify(req.requestBody)}`;
      }
    } else {
      bodySnippet = `data=${JSON.stringify(req.requestBody)}`;
    }
  }
  const args = [`method=${JSON.stringify(req.method)}`, `url=${JSON.stringify(req.url)}`, 'headers=headers'];
  if (bodySnippet) args.push(bodySnippet);
  return `import requests

${headersBlock}

resp = requests.request(${args.join(', ')})
print(resp.status_code)
print(resp.text)`;
}

// === HTTP Logging ===
chrome.devtools.network.onRequestFinished.addListener((req) => {
  try {
    req.getContent((body) => {
      if (chrome.runtime.lastError) {
        console.warn("getContent ошибка:", chrome.runtime.lastError.message);
        return;
      }
      const item = {
        url: req.request.url,
        method: req.request.method,
        status: req.response.status,
        requestHeaders: Object.fromEntries(req.request.headers.map((h) => [h.name, h.value])),
        responseHeaders: Object.fromEntries(req.response.headers.map((h) => [h.name, h.value])),
        requestBody: req.request.postData?.text || '',
        responseBody: body || ''
      };
      httpLogs.push(item);
      if (currentTab === 'http') renderList();
    });
  } catch (e) {
    console.warn("Ошибка при getContent:", e);
  }
});

// === UI events ===
searchInput.addEventListener('input', () => {
  console.log('Поиск изменен, рендерим список');
  renderList();
});

tabs.forEach((tab) =>
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    console.log('Переключена вкладка:', currentTab);
    renderList();
  })
);