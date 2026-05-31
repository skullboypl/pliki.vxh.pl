/** WebRTC DataChannel file transfer helpers — retry send + resume incomplete files. */

export const TRANSFER_CONFIG = {
  MAX_SEND_RETRIES: 12,
  MAX_RESUME_ATTEMPTS: 6,
  BUFFERED_LOW_THRESHOLD: 512 * 1024,
  FLUSH_TIMEOUT_MS: 180_000,
  QUIET_AFTER_END_MS: 600,
  QUIET_MAX_WAIT_MS: 180_000,
  SEND_RETRY_BASE_MS: 80,
  SEND_RETRY_MAX_MS: 3000,
  FILE_END_ACK_TIMEOUT_MS: 15_000,
  FILE_END_RETRIES: 4,
} as const;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function ackTimeoutForFileSize(bytes: number): number {
  const mb = bytes / (1024 * 1024);
  return Math.min(180_000, TRANSFER_CONFIG.FILE_END_ACK_TIMEOUT_MS + Math.ceil(mb) * 3000);
}

export function quietMsForFileSize(bytes: number): number {
  const mb = bytes / (1024 * 1024);
  return Math.min(2500, TRANSFER_CONFIG.QUIET_AFTER_END_MS + Math.ceil(mb / 50) * 200);
}

export async function waitBufferedLow(
  dc: RTCDataChannel,
  threshold = TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD,
): Promise<void> {
  if (dc.bufferedAmount <= threshold) return;
  await new Promise<void>((res) => {
    const onLow = () => {
      dc.removeEventListener('bufferedamountlow', onLow);
      res();
    };
    dc.addEventListener('bufferedamountlow', onLow, { once: true });
  });
}

export async function waitAllFlushed(
  dc: RTCDataChannel,
  low = 0,
  timeoutMs = TRANSFER_CONFIG.FLUSH_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (dc.bufferedAmount > low && Date.now() < deadline) {
    await new Promise<void>((res) => {
      if (dc.bufferedAmount <= low) {
        res();
        return;
      }
      const onLow = () => {
        dc.removeEventListener('bufferedamountlow', onLow);
        res();
      };
      dc.addEventListener('bufferedamountlow', onLow, { once: true });
      setTimeout(() => {
        dc.removeEventListener('bufferedamountlow', onLow);
        res();
      }, 500);
    });
  }
  return dc.bufferedAmount <= low;
}

export async function sendBinaryWithRetry(
  dc: RTCDataChannel,
  data: ArrayBuffer | ArrayBufferView,
  opts?: { maxRetries?: number; abort?: () => boolean; threshold?: number },
): Promise<void> {
  const maxRetries = opts?.maxRetries ?? TRANSFER_CONFIG.MAX_SEND_RETRIES;
  const threshold = opts?.threshold ?? TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD;
  const payload =
    data instanceof ArrayBuffer
      ? data
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength).buffer;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (opts?.abort?.()) throw new Error('cancelled');
    if (dc.readyState !== 'open') throw new Error('data channel closed');

    try {
      await waitBufferedLow(dc, threshold);
      dc.send(payload as ArrayBuffer);
      return;
    } catch (err) {
      if (attempt >= maxRetries - 1) throw err;
      const delay = Math.min(
        TRANSFER_CONFIG.SEND_RETRY_MAX_MS,
        TRANSFER_CONFIG.SEND_RETRY_BASE_MS * 2 ** attempt,
      );
      await sleep(delay);
    }
  }
}

export type SendBlobOptions = {
  chunkSize: number;
  onProgress?: (sentSoFar: number, totalSize: number) => void;
  abort?: () => boolean;
  /** Bytes confirmed on receiver before this run (resume). */
  baseOffset?: number;
  totalSize?: number;
};

export async function sendBlobChunks(
  dc: RTCDataChannel,
  blob: Blob,
  options: SendBlobOptions,
): Promise<number> {
  const reader = blob.stream().getReader();
  const chunkSize = options.chunkSize;
  const baseOffset = options.baseOffset ?? 0;
  const totalSize = options.totalSize ?? blob.size + baseOffset;
  let sessionSent = 0;
  let lastUi = 0;

  try {
    while (true) {
      if (options.abort?.()) {
        await reader.cancel();
        throw new Error('cancelled');
      }
      const { value, done } = await reader.read();
      if (done) break;

      const data =
        value instanceof Uint8Array
          ? value
          : new Uint8Array((value as ArrayBufferView).buffer || value);

      for (let off = 0; off < data.byteLength; off += chunkSize) {
        if (options.abort?.()) {
          await reader.cancel();
          throw new Error('cancelled');
        }
        const end = Math.min(off + chunkSize, data.byteLength);
        const chunk = data.subarray(off, end);
        await sendBinaryWithRetry(dc, chunk, { abort: options.abort });
        sessionSent += end - off;
        const now = performance.now();
        if (now - lastUi > 100) {
          lastUi = now;
          options.onProgress?.(baseOffset + sessionSent, totalSize);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }

  options.onProgress?.(baseOffset + sessionSent, totalSize);
  return sessionSent;
}

export type SendCompleteResult = 'ack' | 'incomplete' | 'timeout';

/** Wait for file_end_ack or file_incomplete from receiver. Sends file_end each attempt. */
export async function waitForSendComplete(
  ctrlDc: RTCDataChannel,
  onIncomplete: (got: number, expected: number) => void,
  timeoutMs: number = TRANSFER_CONFIG.FILE_END_ACK_TIMEOUT_MS,
): Promise<SendCompleteResult> {
  for (let attempt = 0; attempt < TRANSFER_CONFIG.FILE_END_RETRIES; attempt++) {
    const result = await new Promise<SendCompleteResult>((resolve) => {
      const onMsg = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(String(ev.data)) as {
            type?: string;
            got?: number;
            expected?: number;
          };
          if (parsed.type === 'file_end_ack') {
            cleanup();
            resolve('ack');
          } else if (parsed.type === 'file_incomplete') {
            cleanup();
            onIncomplete(Number(parsed.got) || 0, Number(parsed.expected) || 0);
            resolve('incomplete');
          }
        } catch {
          /* ignore non-json ctrl messages */
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve('timeout');
      }, timeoutMs);

      const cleanup = () => {
        ctrlDc.removeEventListener('message', onMsg);
        clearTimeout(timer);
      };

      ctrlDc.addEventListener('message', onMsg);
      try {
        ctrlDc.send(JSON.stringify({ type: 'file_end' }));
      } catch {
        cleanup();
        resolve('timeout');
      }
    });

    if (result !== 'timeout') return result;
    if (attempt < TRANSFER_CONFIG.FILE_END_RETRIES - 1) {
      await sleep(800);
    }
  }
  return 'timeout';
}
