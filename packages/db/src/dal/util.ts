// Unwraps the row from an insert/returning that is guaranteed to produce exactly one row.
export function one<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('expected exactly one row');
  return row;
}
