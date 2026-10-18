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
