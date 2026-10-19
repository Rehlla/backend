import { BaseRepository } from './BaseRepository';
import { BookingEntity, PaymentEntity } from '../schema';
import { db } from '../database';

export class BookingRepository extends BaseRepository<BookingEntity> {
  constructor() {
    super(database => database.bookings);
  }

  public async findByReference(bookingRef: string): Promise<BookingEntity | null> {
    return this.findOne(b => b.bookingRef === bookingRef || b.confirmationCode === bookingRef);
  }

  public async findByTripId(tripId: string): Promise<BookingEntity[]> {
    return this.findMany(b => b.tripId === tripId);
  }

  public async findByTravelerEmail(email: string): Promise<BookingEntity[]> {
    return this.findMany(b => b.travelerEmail.toLowerCase() === email.toLowerCase());
  }

  public async findBySupplierId(supplierId: string): Promise<BookingEntity[]> {
    return this.findMany(b => b.supplierId === supplierId);
  }

  public async getPaymentsForBooking(bookingId: string): Promise<PaymentEntity[]> {
    const payments = db.payments.filter(p => p.bookingId === bookingId);
    return JSON.parse(JSON.stringify(payments));
  }
}

export const bookingRepository = new BookingRepository();
