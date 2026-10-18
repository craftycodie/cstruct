import { COMPILE, type Codec } from "../engine/codec";
import type { FieldOptions } from "../field";
import { CFieldType, type Endian } from "../field-type";

/** Explicit padding bytes in a struct layout. Omitted from inferred TypeScript types. */
export class CPadding<const O extends FieldOptions = {}> extends CFieldType<
  undefined,
  O
> {
  readonly bytes: number;

  constructor(bytes: number, options?: O) {
    super(options);
    this.bytes = bytes;
  }

  getSize(): number {
    return this.bytes;
  }

  read(_buffer: Uint8Array, _offset: number, _endian: Endian): undefined {
    return;
  }

  write(
    buffer: Uint8Array,
    offset: number,
    _value: undefined,
    _endian: Endian
  ): void {
    buffer.fill(0, offset, offset + this.bytes);
  }

  [COMPILE](_endian: Endian): Codec<undefined> {
    const bytes = this.bytes;
    return {
      read: () => undefined,
      write: (ctx, at) => {
        ctx.u8.fill(0, at, at + bytes);
      },
    };
  }
}

export function createPadding(bytes: number): CPadding {
  return new CPadding(bytes);
}

export function pad<const O extends FieldOptions = {}>(
  bytes: number,
  options?: O
): CPadding<O> {
  return new CPadding(bytes, options);
}

export function isCPadding(value: unknown): value is CPadding {
  return value instanceof CPadding;
}
