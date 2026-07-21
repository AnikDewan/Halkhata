/** Error raised by SQLite's case-insensitive unique customer-name index. */
export function isDuplicateCustomerNameError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("customers_name_unique") ||
    /UNIQUE constraint failed:.*customers\.name/i.test(message)
  );
}
