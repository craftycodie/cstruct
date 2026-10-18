/** Byte sources accepted by reads. */
export type BytesLike = Uint8Array | ArrayBuffer | DataView;

type BufferCtor = typeof Buffer;

let bufferImpl: BufferCtor | undefined = (globalThis as { Buffer?: BufferCtor })
  .Buffer;

/** @internal Test hook: simulate a runtime without `Buffer`. */
export function setBufferImplForTesting(impl: BufferCtor | undefined): void {
  bufferImpl = impl;
}

/**
 * Per-call view over the bytes being read or written. One context is created
 * per top-level call and never pooled: a custom field type may re-enter
 * `c.read` from inside its own `read`.
 */
export interface Ctx {
  /** Lazily created `Buffer` over the same memory, when `Buffer` exists. */
  buf: Buffer | undefined;
  readonly dv: DataView;
  readonly u8: Uint8Array;
}

export function toBytes(input: BytesLike): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  throw new TypeError(
    "expected a Buffer, Uint8Array, ArrayBuffer or DataView to read from"
  );
}

export function createCtx(input: BytesLike): Ctx {
  const u8 = toBytes(input);
  return {
    u8,
    dv: new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
    buf: bufferImpl?.isBuffer(u8) ? u8 : undefined,
  };
}

/** A `Buffer` over the context's bytes, or undefined without `Buffer`. */
export function ctxBuffer(ctx: Ctx): Buffer | undefined {
  if (ctx.buf === undefined && bufferImpl !== undefined) {
    ctx.buf = bufferImpl.from(
      ctx.u8.buffer,
      ctx.u8.byteOffset,
      ctx.u8.byteLength
    );
  }
  return ctx.buf;
}

/** Zeroed output bytes: a `Buffer` when available, else a `Uint8Array`. */
export function allocBytes(size: number): Buffer {
  return (bufferImpl ? bufferImpl.alloc(size) : new Uint8Array(size)) as Buffer;
}

/** Throws unless `size` bytes starting at `offset` lie inside `bytes`. */
export function checkRange(
  bytes: Uint8Array,
  offset: number,
  size: number
): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + size > bytes.length) {
    throw new RangeError(
      `need ${size} bytes at offset ${offset}, but the buffer has ${bytes.length}`
    );
  }
}
