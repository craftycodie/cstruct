import { asCStructError } from "../errors";
import type { ResolvedWrite } from "../options";
import { type Codec, NO_PARENT } from "./codec";
import { allocBytes, type BytesLike, checkRange, createCtx } from "./ctx";

/** Top-level read: bounds check once, wrap errors as CStructError. */
export function runRead<T>(
  codec: Codec<T>,
  size: number,
  buffer: BytesLike,
  offset: number
): T {
  try {
    const ctx = createCtx(buffer);
    checkRange(ctx.u8, offset, size);
    return codec.read(ctx, offset, NO_PARENT);
  } catch (error) {
    throw asCStructError(error, "read");
  }
}

/** Top-level write into fresh bytes or a zeroed range of `into`. */
export function runWrite(
  codec: Codec,
  size: number,
  data: unknown,
  { into, offset }: ResolvedWrite
): Buffer {
  const target = into ?? allocBytes(size);
  const at = into ? offset : 0;
  try {
    const ctx = createCtx(target);
    if (into) {
      checkRange(ctx.u8, at, size);
      ctx.u8.fill(0, at, at + size);
    }
    codec.write(ctx, at, data, NO_PARENT);
  } catch (error) {
    throw asCStructError(error, "write");
  }
  return target as Buffer;
}
