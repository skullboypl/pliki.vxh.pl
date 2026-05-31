import { io, type Socket } from 'socket.io-client';

/** Debounced teardown avoids Strict Mode double-mount closing WS mid-handshake (dev console noise). */
const RELEASE_DELAY_MS = 150;

let sharedSocket: Socket | null = null;
let refCount = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function acquireSignalingSocket(origin: string): Socket {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  refCount += 1;

  if (!sharedSocket) {
    sharedSocket = io(origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
  }

  return sharedSocket;
}

export function releaseSignalingSocket(): void {
  refCount = Math.max(0, refCount - 1);

  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }

  if (refCount > 0 || !sharedSocket) return;

  const socket = sharedSocket;
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    if (refCount > 0 || sharedSocket !== socket) return;
    socket.removeAllListeners();
    socket.disconnect();
    sharedSocket = null;
  }, RELEASE_DELAY_MS);
}
