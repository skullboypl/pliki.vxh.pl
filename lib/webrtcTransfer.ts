/** WebRTC DataChannel file transfer helpers — retry send + resume incomplete files. */

export const TRANSFER_CONFIG = {
  MAX_SEND_RETRIES: 12,
  MAX_RESUME_ATTEMPTS: 6,
  /** Resume sending when bufferedAmount drops below this (desktop). */
  BUFFERED_LOW_THRESHOLD: 2 * 1024 * 1024,
  /** Keep piping chunks until send buffer reaches this (desktop). */
  BUFFERED_HIGH_WATERMARK: 6 * 1024 * 1024,
  BUFFERED_LOW_THRESHOLD_MOBILE: 768 * 1024,
  BUFFERED_HIGH_WATERMARK_MOBILE: 2 * 1024 * 1024,
  OPFS_WRITE_BATCH_BYTES: 1024 * 1024,
  OPFS_WRITE_BATCH_BYTES_MOBILE: 512 * 1024,
  RECV_BACKPRESSURE_PAUSE_BYTES: 10 * 1024 * 1024,
  RECV_BACKPRESSURE_RESUME_BYTES: 4 * 1024 * 1024,
  FLUSH_TIMEOUT_MS: 180_000,
  QUIET_AFTER_END_MS: 600,
  QUIET_MAX_WAIT_MS: 180_000,
  SEND_RETRY_BASE_MS: 80,
  SEND_RETRY_MAX_MS: 3000,
  FILE_END_ACK_TIMEOUT_MS: 15_000,
  FILE_END_RETRIES: 4,
} as const;

export type TransferTuning = {
  chunkSize: number;
  bufferedLow: number;
  bufferedHigh: number;
  opfsWriteBatch: number;
};

/** Chunk + buffer sizes from SCTP maxMessageSize and device class. */
export function pickTransferTuning(maxMessageSize: number, mobile: boolean): TransferTuning {
  const max = maxMessageSize > 0 ? maxMessageSize : 256 * 1024;
  const chunkSize = mobile
    ? Math.max(48 * 1024, Math.min(96 * 1024, max - 1024))
    : Math.max(64 * 1024, Math.min(max - 1024, 256 * 1024));
  return {
    chunkSize,
    bufferedLow: mobile
      ? TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD_MOBILE
      : TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD,
    bufferedHigh: mobile
      ? TRANSFER_CONFIG.BUFFERED_HIGH_WATERMARK_MOBILE
      : TRANSFER_CONFIG.BUFFERED_HIGH_WATERMARK,
    opfsWriteBatch: mobile
      ? TRANSFER_CONFIG.OPFS_WRITE_BATCH_BYTES_MOBILE
      : TRANSFER_CONFIG.OPFS_WRITE_BATCH_BYTES,
  };
}

export function applyFileChannelTuning(dc: RTCDataChannel, tuning: TransferTuning): void {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = tuning.bufferedLow;
}

/** Extra wait after file_end while disk catches up (large files). */
export function quietMaxWaitForRemaining(remainingBytes: number): number {
  const mb = Math.max(0, remainingBytes) / (1024 * 1024);
  return Math.min(600_000, Math.max(TRANSFER_CONFIG.QUIET_MAX_WAIT_MS, 30_000 + mb * 2500));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Let React paint and other handlers run during long send loops. */
export function yieldToMain(): Promise<void> {
  return new Promise((r) => {
    setTimeout(r, 0);
  });
}

/** Payload for dc.send — avoid copying when the view already spans the exact bytes. */
export function payloadForSend(data: ArrayBuffer | ArrayBufferView): ArrayBuffer | ArrayBufferView {
  if (data instanceof ArrayBuffer) return data;
  const view = data;
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer as ArrayBuffer;
  }
  return view;
}

/** DOM typings are stricter than runtime; binary send accepts Uint8Array subarrays. */
function dcSendBinary(dc: RTCDataChannel, data: ArrayBuffer | Uint8Array): void {
  (dc as RTCDataChannel & { send(data: ArrayBuffer | Uint8Array): void }).send(data);
}

/** Legacy helper — only when a standalone ArrayBuffer is required. */
export function toExactArrayBuffer(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  const payload = payloadForSend(data);
  if (payload instanceof ArrayBuffer) return payload;
  return payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength,
  ) as ArrayBuffer;
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

export async function waitBufferedBelow(
  dc: RTCDataChannel,
  highWatermark: number,
  lowThreshold: number,
): Promise<void> {
  while (dc.bufferedAmount >= highWatermark) {
    await waitBufferedLow(dc, lowThreshold);
  }
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
  opts?: {
    maxRetries?: number;
    abort?: () => boolean;
    threshold?: number;
    highWatermark?: number;
  },
): Promise<void> {
  const maxRetries = opts?.maxRetries ?? TRANSFER_CONFIG.MAX_SEND_RETRIES;
  const threshold = opts?.threshold ?? TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD;
  const high = opts?.highWatermark ?? threshold * 2;
  const payload = payloadForSend(data);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (opts?.abort?.()) throw new Error('cancelled');
    if (dc.readyState !== 'open') throw new Error('data channel closed');

    try {
      await waitBufferedBelow(dc, high, threshold);
      dcSendBinary(dc, payload instanceof ArrayBuffer ? payload : (payload as Uint8Array));
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
  bufferedLow?: number;
  bufferedHigh?: number;
  onProgress?: (sentSoFar: number, totalSize: number) => void;
  abort?: () => boolean;
  /** Bytes already sent — resume without Blob.slice (avoids extra disk quota in Chrome). */
  startByteOffset?: number;
  baseOffset?: number;
  totalSize?: number;
  waitIfPaused?: () => Promise<void>;
};

async function sendChunkPipelined(
  dc: RTCDataChannel,
  chunk: Uint8Array,
  opts: {
    abort?: () => boolean;
    bufferedLow: number;
    bufferedHigh: number;
  },
): Promise<void> {
  for (let attempt = 0; attempt < TRANSFER_CONFIG.MAX_SEND_RETRIES; attempt++) {
    if (opts.abort?.()) throw new Error('cancelled');
    if (dc.readyState !== 'open') throw new Error('data channel closed');

    try {
      await waitBufferedBelow(dc, opts.bufferedHigh, opts.bufferedLow);
      dcSendBinary(dc, chunk);
      return;
    } catch (err) {
      if (attempt >= TRANSFER_CONFIG.MAX_SEND_RETRIES - 1) throw err;
      await sleep(
        Math.min(
          TRANSFER_CONFIG.SEND_RETRY_MAX_MS,
          TRANSFER_CONFIG.SEND_RETRY_BASE_MS * 2 ** attempt,
        ),
      );
    }
  }
}

export async function sendBlobChunks(
  dc: RTCDataChannel,
  blob: Blob,
  options: SendBlobOptions,
): Promise<number> {
  const chunkSize = options.chunkSize;
  const bufferedLow = options.bufferedLow ?? TRANSFER_CONFIG.BUFFERED_LOW_THRESHOLD;
  const bufferedHigh = options.bufferedHigh ?? TRANSFER_CONFIG.BUFFERED_HIGH_WATERMARK;
  const baseOffset = options.baseOffset ?? options.startByteOffset ?? 0;
  const totalSize = options.totalSize ?? blob.size + baseOffset;
  let skipRemaining = Math.max(0, options.startByteOffset ?? 0);
  let sessionSent = 0;
  let lastUi = 0;

  const pipeOpts = { abort: options.abort, bufferedLow, bufferedHigh };
  const reader = blob.stream().getReader();
  let chunksSinceYield = 0;

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
        if (options.waitIfPaused) await options.waitIfPaused();

        const end = Math.min(off + chunkSize, data.byteLength);
        let chunk = data.subarray(off, end);

        if (skipRemaining > 0) {
          if (skipRemaining >= chunk.byteLength) {
            skipRemaining -= chunk.byteLength;
            continue;
          }
          chunk = chunk.subarray(skipRemaining);
          skipRemaining = 0;
        }

        if (dc.bufferedAmount >= bufferedHigh) {
          options.onProgress?.(baseOffset + sessionSent, totalSize);
        }
        const wireChunk =
          chunk.byteLength === chunk.buffer.byteLength &&
          chunk.byteOffset === 0
            ? chunk
            : chunk.slice();
        await sendChunkPipelined(dc, wireChunk, pipeOpts);
        sessionSent += chunk.byteLength;
        chunksSinceYield += 1;
        if (chunksSinceYield >= 12) {
          chunksSinceYield = 0;
          await yieldToMain();
        }

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

export type RecvReadyResult = 'ready' | 'denied' | 'timeout';

export async function waitForRecvReady(
  ctrlDc: RTCDataChannel,
  timeoutMs = 30_000,
): Promise<RecvReadyResult> {
  if (ctrlDc.readyState !== 'open') return 'timeout';

  return new Promise<RecvReadyResult>((resolve) => {
    const onMsg = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as { type?: string };
        if (parsed.type === 'file_recv_ready') {
          cleanup();
          resolve('ready');
        } else if (parsed.type === 'file_recv_denied') {
          cleanup();
          resolve('denied');
        }
      } catch {
        /* ignore */
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
  });
}

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
