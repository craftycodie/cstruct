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

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

/** True when N is written with three or more digits (N >= 100). */
type IsLargeCount<N extends number> =
  `${N}` extends `${Digit}${Digit}${Digit}${string}` ? true : false;

/**
 * Generate a tuple type of length N (mutable, not readonly).
 * Counts of 100 or more widen to T[]: large tuples hit TypeScript's
 * instantiation depth limit and are unreadable in editors anyway.
 */
export type Tuple<T, N extends number> = number extends N
  ? T[]
  : IsLargeCount<N> extends true
    ? T[]
    : BuildTuple<T, N>;

type BuildTuple<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : BuildTuple<T, N, [...R, T]>;
