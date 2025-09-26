const WebSocket = require('ws');

let wss;
const clients = new Map(); // Map to store userId -> ws

const initWebSocket = (server) => {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // The client must send an authentication message with their userId upon connection
            if (data.type === 'authenticate' && data.userId) {
                clients.set(data.userId, ws);
                ws.userId = data.userId; // Attach userId for easier cleanup on close
                console.log(`Client authenticated with userId: ${data.userId}`);
            }
        } catch (e) {
            console.error('Failed to parse message or invalid message format:', message);
        }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      // If the client was authenticated, remove them from the map
      if (ws.userId) {
          clients.delete(ws.userId);
      }
    });
  });

  return wss;
};

const getWss = () => {
  if (!wss) {
    throw new Error('WebSocket server not initialized!');
  }
  return wss;
};

// Function to send a message to a specific user
const sendToUser = (userId, message) => {
    const client = clients.get(userId.toString());
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
};

module.exports = {
  initWebSocket,
  getWss,
  sendToUser,
};