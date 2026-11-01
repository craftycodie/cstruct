/** Byte sources accepted by reads. */
export type BytesLike = Uint8Array | ArrayBuffer | DataView;

/** The parts of Node's `Buffer` that string fields use for text encodings. */
export interface NodeBuffer {
  toString(encoding: string, start: number, end: number): string;
  write(
    value: string,
    offset: number,
    length: number,
    encoding: string
  ): number;
}

interface NodeBufferCtor {
  from(buffer: ArrayBufferLike, byteOffset: number, length: number): NodeBuffer;
  isBuffer(value: unknown): boolean;
}

let bufferImpl: NodeBufferCtor | undefined = (
  globalThis as { Buffer?: NodeBufferCtor }
).Buffer;

/** @internal Test hook: simulate a runtime without `Buffer`. */
export function setBufferImplForTesting(impl: unknown): void {
  bufferImpl = impl as NodeBufferCtor | undefined;
}

/**
 * Per-call view over the bytes being read or written. One context is created
 * per top-level call and never pooled: a custom field type may re-enter
 * `c.read` from inside its own `read`.
 */
export interface Ctx {
  /** Lazily created `Buffer` over the same memory, when `Buffer` exists. */
  buf: NodeBuffer | undefined;
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
    "expected a Uint8Array, ArrayBuffer or DataView to read from"
  );
}

export function createCtx(input: BytesLike): Ctx {
  const u8 = toBytes(input);
  return {
    u8,
    dv: new DataView(u8.buffer, u8.byteOffset, u8.byteLength),
    buf: bufferImpl?.isBuffer(u8) ? (u8 as unknown as NodeBuffer) : undefined,
  };
}

/** A `Buffer` over the context's bytes, or undefined without `Buffer`. */
export function ctxBuffer(ctx: Ctx): NodeBuffer | undefined {
  if (ctx.buf === undefined && bufferImpl !== undefined) {
    ctx.buf = bufferImpl.from(
      ctx.u8.buffer,
      ctx.u8.byteOffset,
      ctx.u8.byteLength
    );
  }
  return ctx.buf;
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
