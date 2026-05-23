/**
 * Error thrown when struct layout, read, or write fails.
 *
 * @example
 * try {
 *   c.read(MyStruct, tooShort);
 * } catch (err) {
 *   if (err instanceof CStructError) {
 *     console.error(err.message);
 *   }
 * }
 */
export class CStructError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CStructError";
  }
}
