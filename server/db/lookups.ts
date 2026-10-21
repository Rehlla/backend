/**
 * One way to resolve a booking by either of its public identifiers.
 *
 * Every booking carries an internal id (what the supplier systems see) and a
 * bookingRef (what the traveller sees and quotes). Clients hold whichever one
 * their last response gave them, so a booking endpoint that accepts only one of
 * the two forces the client to keep both and guess which reads as valid —
 * rentals took only the id while commerce and stays took either. This is the
 * single lookup they all share.
 */
export function findByIdOrRef<T extends { id: string; bookingRef: string }>(
  rows: readonly T[],
  key: string
): T | undefined {
  return rows.find(row => row.id === key || row.bookingRef === key);
}
