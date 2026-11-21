/**
 * PostgREST `ilike` deseninde özel anlamı olan karakterleri kaçırır.
 * `_` tek karakter, `%` ise her şey anlamına gelir; kullanıcı adında
 * `_` ve `.` geçebildiği için bu şart.
 */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
