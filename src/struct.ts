import { isCArray, unwrapArrayElement } from "./array";
import {
  CStructField,
  type FieldType,
  getFieldOptions,
  type FieldOptions as IFieldOptions,
  type StructFieldValue,
  unwrapFieldType,
} from "./field";
import type { Endian as EndianType } from "./field-type";
import {
  type BigintTypeToTS,
  type CBigint,
  type CFieldType,
  type CNumber,
  type CPadding,
  createPadding,
  isCFieldType,
  isCPadding,
  type NumberTypeToTS,
} from "./field-types";
import {
  type CDiscriminatedUnion,
  isCDiscriminatedUnion,
  type UnionOfArms,
} from "./unions";
import type { FlattenIntersection, Tuple, UnionToIntersection } from "./utils";

export type StructFields = Record<string, StructFieldValue>;

type IsAny<T> = 0 extends 1 & T ? true : false;

type FieldValueType<T extends FieldType> =
  IsAny<T> extends true
    ? any
    : T extends CPadding
      ? never
      : T extends CNumber<infer P>
        ? NumberTypeToTS<P>
        : T extends CBigint<infer P>
          ? BigintTypeToTS<P>
          : T extends Struct<infer F>
            ? StructSchemaToTS<F>
            : T extends CDiscriminatedUnion<infer Arms, any>
              ? UnionOfArms<Arms> | null
              : T extends CFieldType<infer AT, any>
                ? AT
                : never;

type ProcessArrayField<K extends string, T, N extends number> = number extends N
  ? { [Key in K]: T[] }
  : { [Key in K]: Tuple<T, N> };

type NestedStructSchema<T> = T extends { readonly struct: infer S }
  ? S extends Struct<infer F>
    ? StructSchemaToTS<F>
    : never
  : never;

type ElementFieldType<T> =
  NestedStructSchema<T> extends never
    ? T extends FieldType
      ? FieldValueType<T>
      : never
    : NestedStructSchema<T>;

type ProcessSchemaField<K extends string, F extends StructFieldValue> =
  IsAny<F> extends true
    ? { [Key in K]: any }
    : F extends {
          readonly __carray: true;
          readonly element: infer ET;
          readonly count: infer N extends number;
        }
      ? ProcessArrayField<K, ElementFieldType<ET>, N>
      : NestedStructSchema<F> extends never
        ? F extends CPadding
          ? {}
          : F extends FieldType
            ? { [Key in K]: FieldValueType<F> }
            : never
        : { [Key in K]: NestedStructSchema<F> };

export type StructSchemaToTS<F extends StructFields> = FlattenIntersection<
  UnionToIntersection<
    {
      [K in keyof F]: ProcessSchemaField<K & string, F[K]>;
    }[keyof F]
  >
>;

export interface StructField {
  count?: number;
  name: string;
  type: FieldType;
}

function normalizeFields(fields: StructFields): StructField[] {
  const result: StructField[] = [];
  for (const [name, value] of Object.entries(fields)) {
    const fieldOptions = getFieldOptions(value);
    if (fieldOptions.padBefore) {
      result.push({
        name: `__pad_before_${name}`,
        type: createPadding(fieldOptions.padBefore),
      });
    }
    if (isCArray(value)) {
      result.push({
        name,
        type: unwrapArrayElement(value.element),
        count: value.count,
      });
    } else {
      result.push({ name, type: unwrapFieldType(value) });
    }
    if (fieldOptions.padAfter) {
      result.push({
        name: `__pad_after_${name}`,
        type: createPadding(fieldOptions.padAfter),
      });
    }
  }
  return result;
}

export class Struct<F extends StructFields = StructFields> {
  private readonly fields: readonly StructField[];
  private readonly size: number;

  private constructor(fields: F) {
    this.fields = normalizeFields(fields);
    this.size = this.calculateSize();
  }

  static struct<const F extends StructFields>(fields: F): Struct<F> {
    return new Struct(fields);
  }

  field<const O extends IFieldOptions = {}>(
    options?: O
  ): CStructField<this, O> {
    return new CStructField(this, options);
  }

  private getFieldSize(field: StructField): number {
    if (isCDiscriminatedUnion(field.type)) {
      return field.type.getSize();
    }
    if (field.type instanceof Struct) {
      return field.type.size;
    }
    if (isCFieldType(field.type)) {
      return field.type.getSize();
    }
    throw new Error(`Unsupported field type for '${field.name}'`);
  }

  private calculateSize(): number {
    let totalSize = 0;
    for (const field of this.fields) {
      const fieldSize = this.getFieldSize(field);
      const count = field.count ?? 1;
      totalSize += fieldSize * count;
    }
    return totalSize;
  }

  read(
    buffer: Buffer,
    offset = 0,
    endian: EndianType = "little"
  ): StructSchemaToTS<F> {
    const result: any = {};
    let currentOffset = 0;

    for (const field of this.fields) {
      if (isCDiscriminatedUnion(field.type)) {
        result[field.name] = field.type.read(
          buffer,
          offset + currentOffset,
          endian,
          result
        );
        currentOffset += field.type.getSize();
        continue;
      }

      if (field.type instanceof Struct) {
        const nestedStruct = field.type;
        const count = field.count ?? 1;

        // `count` is only set for `c.array(...)` / `{ count }`; omit means a single value.
        if (field.count === undefined) {
          result[field.name] = nestedStruct.read(
            buffer,
            offset + currentOffset,
            endian
          );
          currentOffset += nestedStruct.size;
        } else {
          result[field.name] = [];
          for (let i = 0; i < count; i++) {
            result[field.name].push(
              nestedStruct.read(buffer, offset + currentOffset, endian)
            );
            currentOffset += nestedStruct.size;
          }
        }
        continue;
      }

      if (isCFieldType(field.type)) {
        const dataField = field.type;
        const count = field.count ?? 1;

        if (isCPadding(dataField)) {
          currentOffset += dataField.getSize() * count;
          continue;
        }

        if (field.count === undefined) {
          result[field.name] = dataField.read(
            buffer,
            offset + currentOffset,
            endian
          );
          currentOffset += dataField.getSize();
        } else {
          result[field.name] = [];
          for (let i = 0; i < count; i++) {
            result[field.name].push(
              dataField.read(buffer, offset + currentOffset, endian)
            );
            currentOffset += dataField.getSize();
          }
        }
        continue;
      }

      throw new Error(`Unsupported field type for '${field.name}'`);
    }

    return result;
  }

  write(data: Record<string, any>, endian: EndianType = "little"): Buffer {
    const buffer = Buffer.alloc(this.size);
    let currentOffset = 0;

    for (const field of this.fields) {
      try {
        if (isCDiscriminatedUnion(field.type)) {
          field.type.write(
            buffer,
            currentOffset,
            data[field.name],
            endian,
            data
          );
          currentOffset += field.type.getSize();
          continue;
        }

        if (field.type instanceof Struct) {
          const nestedStruct = field.type;
          const count = field.count ?? 1;
          const value = data[field.name];

          if (field.count === undefined) {
            if (value === undefined || value === null) {
              throw new Error(`Field '${field.name}' is ${value}`);
            }
            const nestedBuffer = nestedStruct.write(value, endian);
            nestedBuffer.copy(buffer, currentOffset);
            currentOffset += nestedStruct.size;
          } else {
            if (!Array.isArray(value)) {
              throw new Error(
                `Expected array for field '${field.name}' with count ${count}`
              );
            }
            if (value.length < count) {
              throw new Error(
                `Field '${field.name}' expected ${count} elements but got ${value.length}`
              );
            }
            for (let i = 0; i < count; i++) {
              if (value[i] === undefined) {
                throw new Error(`Field '${field.name}[${i}]' is undefined`);
              }
              const nestedBuffer = nestedStruct.write(value[i], endian);
              nestedBuffer.copy(buffer, currentOffset);
              currentOffset += nestedStruct.size;
            }
          }
          continue;
        }

        if (isCFieldType(field.type)) {
          const dataField = field.type;
          const count = field.count ?? 1;

          if (isCPadding(dataField)) {
            for (let i = 0; i < count; i++) {
              dataField.write(buffer, currentOffset, undefined, endian);
              currentOffset += dataField.getSize();
            }
            continue;
          }

          const value = data[field.name];

          if (field.count === undefined) {
            dataField.write(buffer, currentOffset, value, endian);
            currentOffset += dataField.getSize();
          } else {
            if (!Array.isArray(value)) {
              throw new Error(
                `Expected array for field '${field.name}' with count ${count}`
              );
            }
            if (value.length < count) {
              throw new Error(
                `Field '${field.name}' expected ${count} elements but got ${value.length}`
              );
            }
            for (let i = 0; i < count; i++) {
              dataField.write(buffer, currentOffset, value[i], endian);
              currentOffset += dataField.getSize();
            }
          }
          continue;
        }

        throw new Error(`Unsupported field type for '${field.name}'`);
      } catch (error) {
        throw new Error(`${field.name}: ${error}`);
      }
    }

    return buffer;
  }

  getSize(): number {
    return this.size;
  }
}

type InferType<T> =
  T extends Struct<infer F>
    ? StructSchemaToTS<F>
    : NestedStructSchema<T> extends never
      ? T extends {
          readonly __carray: true;
          readonly element: infer ET;
          readonly count: infer N extends number;
        }
        ? number extends N
          ? InferType<ET>[]
          : Tuple<InferType<ET>, N>
        : T extends {
              readonly __cdiscriminatedUnion: true;
              readonly arms: infer Arms;
            }
          ? Arms extends readonly import("./unions").UnionArmInput[]
            ? UnionOfArms<Arms> | null
            : never
          : T extends FieldType
            ? FieldValueType<T>
            : never
      : NestedStructSchema<T>;

export type UnionOf<Arms extends readonly import("./unions").UnionArmInput[]> =
  UnionOfArms<Arms>;

export type infer<T> = InferType<T>;

export function struct<const F extends StructFields>(fields: F): Struct<F> {
  return Struct.struct(fields);
}
