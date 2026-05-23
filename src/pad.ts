/** Reserved zero bytes inside a struct layout. */
export interface PadField {
  readonly count: number;
  readonly kind: "pad";
}

export function is_pad_field(type: unknown): type is PadField {
  return (
    typeof type === "object" &&
    type !== null &&
    "kind" in type &&
    type.kind === "pad"
  );
}
