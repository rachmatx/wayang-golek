/* ws_client.js — koneksi WebSocket: sambung, putus, sambung-ulang otomatis. */
(function () {
  "use strict";

  const RECONNECT_MS = 2000;

  function createWSClient(options) {
    const url = options.url;
    const onMessage = options.onMessage || function () {};
    const onStatus = options.onStatus || function () {};

    let socket = null;
    let timer = null;
    let manualClose = false;
    let lastStatus = null;

    function setStatus(status) {
      if (status === lastStatus) return;
      lastStatus = status;
      onStatus(status);
    }

    function schedule() {
      if (manualClose) return;
      clearTimeout(timer);
      timer = setTimeout(connect, RECONNECT_MS);
    }

    function connect() {
      if (manualClose) return;
      setStatus("connecting");

      try {
        socket = new WebSocket(url);
      } catch (error) {
        setStatus("disconnected");
        schedule();
        return;
      }

      socket.addEventListener("open", function () {
        setStatus("connected");
      });

      socket.addEventListener("message", function (event) {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (error) {
          return;
        }
        onMessage(message);
      });

      socket.addEventListener("close", function () {
        socket = null;
        setStatus("disconnected");
        schedule();
      });

      socket.addEventListener("error", function () {
        try {
          socket.close();
        } catch (error) {
          /* diabaikan */
        }
      });
    }

    function send(payload) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      try {
        socket.send(JSON.stringify(payload));
        return true;
      } catch (error) {
        return false;
      }
    }

    function close() {
      manualClose = true;
      clearTimeout(timer);
      if (socket) socket.close();
    }

    return { connect: connect, send: send, close: close };
  }

  window.createWSClient = createWSClient;
})();
