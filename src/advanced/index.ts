import { AdvancedType } from "./advanced-type";

export { AdvancedType, need_bytes } from "./advanced-type";
export { CString, String } from "./string";
export {
  CTime64,
  date_to_time64_seconds,
  Time64,
  time64_seconds_to_date,
} from "./time64";
export { CWString, WString } from "./wstring";

export function is_advanced_type(type: unknown): type is AdvancedType<unknown> {
  return type instanceof AdvancedType;
}
