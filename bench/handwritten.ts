/**
 * Hand-written DataView codecs: the speed-of-light baseline that cstruct
 * results are reported against.
 */
import { VEC3_COUNT } from "./schemas";

const LE = true;

export function readFlat16(bytes: Buffer) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    a: view.getUint8(0),
    b: view.getInt8(1),
    c: view.getUint16(2, LE),
    d: view.getInt16(4, LE),
    e: view.getUint32(6, LE),
    f: view.getInt32(10, LE),
    g: view.getFloat32(14, LE),
    h: view.getFloat64(18, LE),
    i: view.getUint8(26),
    j: view.getUint8(27),
    k: view.getUint16(28, LE),
    l: view.getUint32(30, LE),
    m: view.getInt32(34, LE),
    n: view.getFloat32(38, LE),
    o: view.getUint16(42, LE),
    p: view.getUint16(44, LE),
  };
}

export function writeFlat16(value: ReturnType<typeof readFlat16>): Buffer {
  const bytes = Buffer.alloc(46);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint8(0, value.a);
  view.setInt8(1, value.b);
  view.setUint16(2, value.c, LE);
  view.setInt16(4, value.d, LE);
  view.setUint32(6, value.e, LE);
  view.setInt32(10, value.f, LE);
  view.setFloat32(14, value.g, LE);
  view.setFloat64(18, value.h, LE);
  view.setUint8(26, value.i);
  view.setUint8(27, value.j);
  view.setUint16(28, value.k, LE);
  view.setUint32(30, value.l, LE);
  view.setInt32(34, value.m, LE);
  view.setFloat32(38, value.n, LE);
  view.setUint16(42, value.o, LE);
  view.setUint16(44, value.p, LE);
  return bytes;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function readVec3Array(bytes: Buffer): { points: Vec3[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const points: Vec3[] = new Array(VEC3_COUNT);
  for (let i = 0; i < VEC3_COUNT; i++) {
    const at = i * 12;
    points[i] = {
      x: view.getFloat32(at, LE),
      y: view.getFloat32(at + 4, LE),
      z: view.getFloat32(at + 8, LE),
    };
  }
  return { points };
}

export function writeVec3Array(value: { points: Vec3[] }): Buffer {
  const bytes = Buffer.alloc(VEC3_COUNT * 12);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < VEC3_COUNT; i++) {
    const at = i * 12;
    const point = value.points[i];
    view.setFloat32(at, point.x, LE);
    view.setFloat32(at + 4, point.y, LE);
    view.setFloat32(at + 8, point.z, LE);
  }
  return bytes;
}
