/**
 * Union to intersection helper
 */
export type UnionToIntersection<U> = (
  U extends any
    ? (x: U) => void
    : never
) extends (x: infer I) => void
  ? I
  : never;

/**
 * Flatten an intersection of object types into a single object type
 * Converts { a: 1 } & { b: 2 } into { a: 1; b: 2 }
 * Recursively flattens nested object types for cleaner display
 * This makes the type display cleaner in IDEs
 */
export type FlattenIntersection<T> = T extends object
  ? {
      [K in keyof T]: T[K] extends object ? FlattenIntersection<T[K]> : T[K];
    }
  : T;

/**
 * Generate a tuple type of length N (mutable, not readonly)
 */
export type Tuple<T, N extends number, R extends T[] = []> = number extends N
  ? T[]
  : R["length"] extends N
    ? R
    : Tuple<T, N, [...R, T]>;
