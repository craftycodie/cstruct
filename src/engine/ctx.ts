/**
 * Per-call view over the bytes being read or written. One context is created
 * per top-level call and never pooled: a custom field type may re-enter
 * `c.read` from inside its own `read`.
 */
export interface Ctx {
  /** Lazily created `Buffer` over the same memory, for custom field types. */
  buf: Buffer | undefined;
  readonly dv: DataView;
  readonly u8: Uint8Array;
}

export function createCtx(bytes: Uint8Array): Ctx {
  return {
    u8: bytes,
    dv: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    buf: Buffer.isBuffer(bytes) ? bytes : undefined,
  };
}

export function ctxBuffer(ctx: Ctx): Buffer {
  ctx.buf ??= Buffer.from(ctx.u8.buffer, ctx.u8.byteOffset, ctx.u8.byteLength);
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
