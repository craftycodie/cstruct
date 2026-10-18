const CHUNK = 4096;

/** String.fromCharCode over many code units without exceeding argument limits. */
function fromCharCodes(units: number[]): string {
  if (units.length <= CHUNK) {
    return String.fromCharCode.apply(null, units);
  }
  let out = "";
  for (let i = 0; i < units.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, units.slice(i, i + CHUNK));
  }
  return out;
}

/** Decode up to `maxUnits` UTF-16 code units, stopping at the first NUL unit. */
export function decodeUtf16(
  bytes: Uint8Array,
  at: number,
  maxUnits: number,
  little: boolean
): string {
  const units: number[] = [];
  const hiByte = little ? 1 : 0;
  const loByte = little ? 0 : 1;
  for (let i = 0; i < maxUnits; i++) {
    const p = at + i * 2;
    const unit = (bytes[p + hiByte] << 8) | bytes[p + loByte];
    if (unit === 0) {
      break;
    }
    units.push(unit);
  }
  return fromCharCodes(units);
}

/** Encode `value` as UTF-16 into `maxUnits` units, zero-filling the rest. */
export function encodeUtf16(
  bytes: Uint8Array,
  at: number,
  maxUnits: number,
  value: string,
  little: boolean
): void {
  const hiByte = little ? 1 : 0;
  const loByte = little ? 0 : 1;
  const count = Math.min(value.length, maxUnits);
  for (let i = 0; i < count; i++) {
    const unit = value.charCodeAt(i);
    const p = at + i * 2;
    bytes[p + hiByte] = unit >>> 8;
    bytes[p + loByte] = unit & 0xff;
  }
  bytes.fill(0, at + count * 2, at + maxUnits * 2);
}

const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();

function normalizeEncoding(encoding: string): string {
  const lower = encoding.toLowerCase();
  switch (lower) {
    case "utf-8":
      return "utf8";
    case "binary":
      return "latin1";
    case "ucs2":
    case "ucs-2":
    case "utf-16le":
      return "utf16le";
    default:
      return lower;
  }
}

function needsBuffer(encoding: string): never {
  throw new Error(
    `c.String encoding '${encoding}' needs Buffer, which this runtime lacks`
  );
}

/**
 * Decode bytes [start, end) without Buffer, matching Buffer#toString for the
 * encodings it supports.
 */
export function decodeBytes(
  bytes: Uint8Array,
  start: number,
  end: number,
  encoding: string
): string {
  switch (normalizeEncoding(encoding)) {
    case "utf8":
      return utf8Decoder.decode(bytes.subarray(start, end));
    case "latin1":
    case "ascii": {
      const mask = normalizeEncoding(encoding) === "ascii" ? 0x7f : 0xff;
      const units: number[] = [];
      for (let i = start; i < end; i++) {
        units.push(bytes[i] & mask);
      }
      return fromCharCodes(units);
    }
    case "utf16le":
      return decodeUtf16(bytes, start, (end - start) >> 1, true);
    default:
      return needsBuffer(encoding);
  }
}

/**
 * Encode `value` into at most `length` bytes at `at` without Buffer, never
 * splitting a character. Returns the number of bytes written.
 */
export function encodeBytes(
  bytes: Uint8Array,
  at: number,
  length: number,
  value: string,
  encoding: string
): number {
  switch (normalizeEncoding(encoding)) {
    case "utf8":
      return utf8Encoder.encodeInto(value, bytes.subarray(at, at + length))
        .written;
    case "latin1":
    case "ascii": {
      const count = Math.min(value.length, length);
      for (let i = 0; i < count; i++) {
        bytes[at + i] = value.charCodeAt(i) & 0xff;
      }
      return count;
    }
    case "utf16le": {
      const units = Math.min(value.length, length >> 1);
      for (let i = 0; i < units; i++) {
        const unit = value.charCodeAt(i);
        bytes[at + i * 2] = unit & 0xff;
        bytes[at + i * 2 + 1] = unit >>> 8;
      }
      return units * 2;
    }
    default:
      return needsBuffer(encoding);
  }
}
