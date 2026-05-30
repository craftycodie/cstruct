import type { JsonValue } from "../json";
import { AdvancedType } from "./advanced-type";

export { AdvancedType, need_bytes } from "./advanced-type";

export type {
  Bitfield,
  BitfieldFlag,
  BitfieldFlagDefinition,
  BitfieldFlagMap,
  BitfieldFlagNames,
  BitfieldJson,
} from "./bitfield";
export { CBitfield } from "./bitfield";
export { Bool, CBool } from "./bool";
export { CI64, CU64, I64, U64 } from "./int64";
export { CString, String } from "./string";
export { CTime64, Time64 } from "./time64";
export { CWString, WString } from "./wstring";

export function is_advanced_type(
  type: unknown
): type is AdvancedType<unknown, JsonValue> {
  return type instanceof AdvancedType;
}
