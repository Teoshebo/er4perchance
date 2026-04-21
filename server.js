const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Размеры игрового поля (должны совпадать с CSS)
const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 600;
const CIRCLE_SIZE = 40;

// Начальное положение круга (центр поля)
let circlePos = {
  x: (FIELD_WIDTH - CIRCLE_SIZE) / 2,
  y: (FIELD_HEIGHT - CIRCLE_SIZE) / 2
};

// Случайный цвет круга (генерируется один раз)
let circleColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

let connectedSockets = []; // список ID в порядке подключения
let controllerId = null;

// Проверка границ поля
function clampPosition(x, y) {
  return {
    x: Math.min(Math.max(x, 0), FIELD_WIDTH - CIRCLE_SIZE),
    y: Math.min(Math.max(y, 0), FIELD_HEIGHT - CIRCLE_SIZE)
  };
}

// Обновить контроллёра и оповестить всех
function setNewController() {
  if (connectedSockets.length > 0) {
    controllerId = connectedSockets[0];
    // Оповещаем всех о новом контроллёре и текущем состоянии
    io.emit('controllerChanged', { controllerId, position: circlePos, color: circleColor });
  } else {
    controllerId = null;
    io.emit('controllerChanged', { controllerId: null, position: circlePos, color: circleColor });
  }
}

io.on('connection', (socket) => {
  console.log(`Пользователь подключился: ${socket.id}`);
  connectedSockets.push(socket.id);

  // Если это первый — делаем контроллёром
  if (controllerId === null) {
    setNewController();
  } else {
    // Отправляем новому клиенту текущее состояние
    socket.emit('initState', {
      position: circlePos,
      color: circleColor,
      controllerId: controllerId
    });
    // Оповещаем всех об обновлении списка (для логов)
    io.emit('clientsCount', connectedSockets.length);
  }

  // Клиент двигает курсором (только если он контроллёр)
  socket.on('cursorMove', (data) => {
    if (socket.id !== controllerId) return; // игнорируем не-контроллёров

    const newPos = clampPosition(data.x, data.y);
    circlePos = newPos;

    // Рассылаем новое положение всем клиентам
    io.emit('circleUpdate', { position: circlePos, color: circleColor });
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    console.log(`Пользователь отключился: ${socket.id}`);
    const index = connectedSockets.indexOf(socket.id);
    if (index !== -1) connectedSockets.splice(index, 1);

    if (socket.id === controllerId) {
      // Если отключился контроллёр — назначаем нового
      setNewController();
    } else {
      io.emit('clientsCount', connectedSockets.length);
    }
  });
});

// Раздача статики
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Цвет круга: ${circleColor}`);
});
