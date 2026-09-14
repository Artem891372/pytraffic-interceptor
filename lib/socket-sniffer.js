// socket-sniffer.js
WebSocket.prototype = null; // Предотвращаем ошибки при наследовании
const ORIGINAL_WEBSOCKET = WebSocket;
var WebSocket = window.WebSocket = class extends WebSocket {
  constructor(...args) {
    super(...args);
    console.log('Создан новый WebSocket:', args);

    this.addEventListener('message', event => {
      const ws_sniff_debug_from = new CustomEvent("ws_sniff_debug_from", {
        detail: {
          data: event.data, // Передаем только event.data (строка или JSON)
          url: this.url // Передаем URL WebSocket для идентификации
        }
      });
      /* console.log('Создано событие ws_sniff_debug_from:', ws_sniff_debug_from);
      console.log('Данные события ws_sniff_debug_from:', ws_sniff_debug_from.detail); */
      document.body.dispatchEvent(ws_sniff_debug_from);
    });

    this.addEventListener('open', event => {
      const ws_sniff_debug_open = new CustomEvent("ws_sniff_debug_open", {
        detail: {
          data: null, // Событие open не содержит данных
          url: this.url // Передаем URL WebSocket
        }
      });
      /* console.log('Создано событие ws_sniff_debug_open:', ws_sniff_debug_open);
      console.log('Данные события ws_sniff_debug_open:', ws_sniff_debug_open.detail); */
      document.body.dispatchEvent(ws_sniff_debug_open);
    });
  }

  send(...args) {
    const ws_sniff_debug_to = new CustomEvent("ws_sniff_debug_to", {
      detail: {
        data: args[0], // Данные уже сериализуемы (строка или JSON)
        url: this.url // Передаем URL WebSocket
      }
    });
/*     console.log('Создано событие ws_sniff_debug_to:', ws_sniff_debug_to);
    console.log('Данные события ws_sniff_debug_to:', ws_sniff_debug_to.detail); */
    document.body.dispatchEvent(ws_sniff_debug_to);
    super.send(...args);
  }
};
console.log('socket-sniffer.js загружен');