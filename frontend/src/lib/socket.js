import { io } from 'socket.io-client';
import { API_URL } from './api';

let socket = null;

export function connectSocket(token) {
  if (socket?.connected) return socket;
  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}