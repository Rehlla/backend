import crypto from 'crypto';
import { db } from '../db/database';
import { HoldEntity, BookingEntity, TransferTelemetryEntity, InventorySlotEntity, ProductSkuEntity } from '../db/schema';
import { paymentService } from './paymentService';
import { notificationService } from './notificationService';
import { transferRouteService } from './transferRouteService';
import { distributedLockService } from './distributedLockService';
import { assertSupplierBookable, InsufficientCapacityError, priceSkuLine } from './commerceService';
import { assertTransition } from './bookingLifecycle';
import { supplierService } from './supplierService';
import { assertCheckoutAllowed } from './fraudDetectionService';
import { transferHubService } from './transferHubService';

const HOLD_TTL_MINUTES = 15;

export class TransferService {
  /**
   * Materialize (or reuse) a real ProductSku for a route + tier.
   *
   * The dynamic route catalog is priced by formula (base + per-km × tier) rather
   * than a flat list of SKUs, but the commerce pipeline — hold → checkout →
   * ledger → telemetry — is SKU-keyed and takes `sku.basePriceEGP` as the
   * amount. Materialising a SKU per route/tier with the computed price lets the
   * whole existing pipeline handle a transfer without any price ever being
   * trusted from the client. Idempotent: same id returns the existing SKU.
   */
  public ensureSkuForRoute(routeId: string, tierId: 'private' | 'shared' | 'premium'): ProductSkuEntity {
    const route = transferRouteService.getById(routeId);
    if (!route) throw new Error(`Transfer origin not found: ${routeId}`);

    const tier = transferRouteService.getTier(tierId);
    const skuId = `SKU-TRF-${route.id}-${tier.id}`;

    const existing = db.productSkus.find(s => s.id === skuId);
    if (existing) return existing;

    const quote = transferRouteService.quoteRoute(route, tier.id)[0];
    const routeLabelEn = `${route.originEn} → ${route.destinationEn}`;
    const routeLabelAr = `${route.originAr} ← ${route.destinationAr}`;

    const sku: ProductSkuEntity = {
      id: skuId,
      supplierId: 'SUP-SHUTTLE-01',
      serviceType: 'transfer',
      title: `${tier.labelEn} · ${routeLabelEn}`,
      titleAr: `${tier.labelAr} · ${routeLabelAr}`,
      description: tier.vehicleEn,
      routeFrom: route.originEn,
      routeTo: route.destinationEn,
      durationMinutes: route.baseDurationMinutes,
      basePriceEGP: quote.priceEGP,
      currency: 'EGP',
      maxCapacityPerSlot: tier.capacity,
      // Shared seats are sold per person; a private or premium car is one price.
      pricingBasis: tier.id === 'shared' ? 'per_person' : 'per_vehicle',
      active: true,
      includedItems: route.originType === 'airport' ? ['60-minute flight-delay wait'] : undefined,
      cancellationPolicyHours: 12
    };

    db.runInTransaction(() => {
      if (!db.productSkus.some(s => s.id === sku.id)) {
        db.productSkus.push(sku);
      }
    });

    return sku;
  }
  // Check and clean expired holds
  public releaseExpiredHolds() {
    const now = new Date().toISOString();
    db.runInTransaction(() => {
      db.holds.forEach(h => {
        if (h.status === 'ACTIVE' && h.expiresAt < now) {
          h.status = 'EXPIRED';
          const slot = db.inventorySlots.find(s => s.id === h.slotId);
          if (slot) {
            slot.heldCapacity = Math.max(0, slot.heldCapacity - h.passengersCount);
            if (slot.status === 'SOLD_OUT' && slot.reservedCapacity + slot.heldCapacity < slot.totalCapacity) {
              slot.status = 'AVAILABLE';
            }
          }
        }
      });
    });
  }

  public checkAvailability(params: {
    skuId: string;
    date: string;
    timeSlot?: string;
    passengers: number;
  }): {
    available: boolean;
    slots: InventorySlotEntity[];
    priceEGP: number;
    sku: any;
  } {
    this.releaseExpiredHolds();
    const sku = db.productSkus.find(s => s.id === params.skuId);
    if (!sku) {
      throw new Error(`Transfer SKU not found: ${params.skuId}`);
    }

    let slots = db.inventorySlots.filter(s => s.skuId === params.skuId && s.date === params.date);

    // If no slots exist yet for this date, dynamically generate them
    if (slots.length === 0) {
      const times = ['08:00 AM', '10:30 AM', '01:00 PM', '04:30 PM', '08:00 PM', '11:30 PM'];
      times.forEach((t, idx) => {
        const newSlot: InventorySlotEntity = {
          id: `SLOT-${params.skuId}-${params.date}-${idx}`,
          skuId: params.skuId,
          date: params.date,
          timeSlot: t,
          totalCapacity: sku.maxCapacityPerSlot || 6,
          reservedCapacity: 0,
          heldCapacity: 0,
          priceEGP: sku.basePriceEGP,
          status: 'AVAILABLE'
        };
        db.inventorySlots.push(newSlot);
      });
      slots = db.inventorySlots.filter(s => s.skuId === params.skuId && s.date === params.date);
    }

    slots.forEach(s => {
      if (!s.totalCapacity || s.totalCapacity <= 0) {
        s.totalCapacity = sku.maxCapacityPerSlot || 6;
      }
    });

    const availableSlots = slots.filter(s => (s.totalCapacity - (s.reservedCapacity + s.heldCapacity)) >= params.passengers);

    return {
      available: availableSlots.length > 0,
      slots,
      priceEGP: sku.basePriceEGP,
      sku
    };
  }

  public createHold(params: {
    skuId: string;
    tripId: string;
    travelerId: string;
    date: string;
    timeSlot: string;
    passengersCount: number;
    idempotencyKey: string;
  }): HoldEntity {
    this.releaseExpiredHolds();

    // Idempotency
    const existing = db.holds.find(h => h.idempotencyKey === params.idempotencyKey && h.status === 'ACTIVE');
    if (existing) {
      return existing;
    }

    const sku = db.productSkus.find(s => s.id === params.skuId);
    if (!sku) throw new Error('Transfer SKU does not exist');
    // Same gates as commerceService.createHold: no holds against a supplier
    // that is not Active.
    assertSupplierBookable(sku.supplierId, sku.id);

    const lockKey = `lock:slot:${params.skuId}:${params.date}:${params.timeSlot}`;
    const lease = distributedLockService.tryAcquire(lockKey, 5000);

    try {
      let holdResult!: HoldEntity;

      db.runInTransaction(() => {
        let slot = db.inventorySlots.find(s => s.skuId === params.skuId && s.date === params.date && s.timeSlot === params.timeSlot);
        if (!slot) {
          slot = {
            id: `SLOT-${params.skuId}-${params.date}-${Date.now()}`,
            skuId: params.skuId,
            date: params.date,
            timeSlot: params.timeSlot,
            totalCapacity: sku.maxCapacityPerSlot || 6,
            reservedCapacity: 0,
            heldCapacity: 0,
            priceEGP: sku.basePriceEGP,
            status: 'AVAILABLE'
          };
          db.inventorySlots.push(slot);
        }

        if (!slot.totalCapacity || slot.totalCapacity <= 0) {
          slot.totalCapacity = sku.maxCapacityPerSlot || 6;
        }
        slot.reservedCapacity = slot.reservedCapacity || 0;
        slot.heldCapacity = slot.heldCapacity || 0;

        const availableCapacity = slot.totalCapacity - (slot.reservedCapacity + slot.heldCapacity);
        if (availableCapacity < params.passengersCount) {
          throw new InsufficientCapacityError(
            `Only ${Math.max(0, availableCapacity)} place(s) remain for transfer ${sku.title || params.skuId} ` +
            `on ${params.date} at ${params.timeSlot}; ${params.passengersCount} were requested.`,
            { skuId: params.skuId, date: params.date, timeSlot: params.timeSlot, requested: params.passengersCount, available: Math.max(0, availableCapacity) }
          );
        }

        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + HOLD_TTL_MINUTES);

        const holdToken = `HLD-TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const hold: HoldEntity = {
          id: `HOLD-${Date.now()}`,
          holdToken,
          skuId: params.skuId,
          slotId: slot.id,
          tripId: params.tripId,
          travelerId: params.travelerId,
          serviceType: 'transfer',
          passengersCount: params.passengersCount,
          // The party's price under the one pricing rule, as commerceService.createHold.
          amountEGP: priceSkuLine(sku, params.passengersCount).amountEGP,
          expiresAt: expires.toISOString(),
          status: 'ACTIVE',
          idempotencyKey: params.idempotencyKey,
          createdAt: new Date().toISOString()
        };

        slot.heldCapacity += params.passengersCount;
        if (slot.reservedCapacity + slot.heldCapacity >= slot.totalCapacity) {
          slot.status = 'SOLD_OUT';
        }
        db.holds.push(hold);
        db.logAudit(params.travelerId, 'Traveler', 'HOLD_CREATED', 'Hold', hold.id, {
          holdToken,
          expiresAt: hold.expiresAt,
          amountEGP: hold.amountEGP
        });
        db.saveToDisk();
        holdResult = hold;
      });

      return holdResult;
    } finally {
      if (lease) {
        distributedLockService.release(lease);
      }
    }
  }

  public completeBooking(params: {
    holdToken: string;
    tripId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    pickupLocation: string;
    dropoffLocation: string;
    flightNumber?: string;
    specialRequests?: string;
    scheduledDate: string;
    scheduledTime: string;
    paymentParams: {
      /** Last four digits only — full PANs must never reach the server. */
      cardLast4?: string;
      cardBrand?: string;
      cardHolderName?: string;
      idempotencyKey: string;
      provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
    };
  }): { booking: BookingEntity; telemetry: TransferTelemetryEntity } {
    this.releaseExpiredHolds();

    // Idempotency: if this payment key was already settled, return the
    // existing booking instead of creating a duplicate.
    const existingPayment = db.payments.find(p => p.idempotencyKey === params.paymentParams.idempotencyKey);
    if (existingPayment) {
      // CASH_ON_ARRIVAL payments remain PENDING (no money captured), so
      // filtering on CAPTURED silently skips them and creates duplicates on
      // retry. The booking created by the first attempt is any non-terminal
      // booking filed against this trip with this hold's SKU.
      const existingBooking = db.bookings.find(
        b => b.tripId === params.tripId && !['CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED'].includes(b.supplierState)
      );
      const existingTelemetry = existingBooking
        ? db.transferTelemetry.find(t => t.bookingId === existingBooking.id)
        : undefined;
      if (existingBooking && existingTelemetry) {
        return { booking: existingBooking, telemetry: existingTelemetry };
      }
    }

    // Validate everything BEFORE touching payment or inventory
    const hold = db.holds.find(h => h.holdToken === params.holdToken);
    if (!hold || hold.status !== 'ACTIVE') {
      throw new Error('Hold token has expired or is invalid. Please select your slot again.');
    }

    const sku = db.productSkus.find(s => s.id === hold.skuId);
    if (!sku) throw new Error('Product SKU not found');
    // Before payment: the supplier may have been suspended since the hold.
    assertSupplierBookable(sku.supplierId, sku.id);

    const bookingRef = `DHB-TRF-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const confirmationCode = `DHB-SSH-${crypto.randomBytes(4).toString('hex').toUpperCase()}-OK`;
    const now = new Date().toISOString();

    // Fraud gate — the same call multi-service and rental checkout make. This
    // path never ran it. Skipped for a key that already settled: that is a
    // retry, and scoring it would match duplicate_payment and block the user.
    if (!existingPayment) {
      assertCheckoutAllowed({
        userId: hold.travelerId,
        transactionId: params.paymentParams.idempotencyKey,
        amountEGP: hold.amountEGP,
        bookingId: bookingRef
      });
    }

    // 1. Process payment BEFORE the booking transaction — if payment fails,
    // no booking is created and no inventory is consumed.
    const paymentResult = paymentService.processCheckout({
      idempotencyKey: params.paymentParams.idempotencyKey,
      tripId: params.tripId,
      holdToken: params.holdToken,
      bookingId: bookingRef,
      amountEGP: hold.amountEGP,
      provider: params.paymentParams.provider || 'PAYMOB',
      cardLast4: params.paymentParams.cardLast4,
      cardBrand: params.paymentParams.cardBrand,
      cardHolderName: params.paymentParams.cardHolderName,
      payerEmail: params.travelerEmail,
      payerPhone: params.travelerPhone
    });

    return db.runInTransaction(() => {
      // 2. Mark hold as converted & update slot capacity
      hold.status = 'CONVERTED';
      const slot = db.inventorySlots.find(s => s.id === hold.slotId);
      if (slot) {
        slot.heldCapacity = Math.max(0, slot.heldCapacity - hold.passengersCount);
        slot.reservedCapacity += hold.passengersCount;
        if (slot.reservedCapacity >= slot.totalCapacity) {
          slot.status = 'SOLD_OUT';
        }
      }

      // 3. Create Booking Entity — no hardcoded supplier assignment;
      // the supplier accepts or rejects via updateBookingState.
      const booking: BookingEntity = {
        id: bookingRef,
        bookingRef,
        tripId: params.tripId,
        supplierId: sku.supplierId,
        skuId: hold.skuId,
        serviceType: 'transfer',
        amountEGP: hold.amountEGP,
        paymentState: paymentResult.payment.state,
        supplierState: 'PENDING_CONFIRMATION',
        travelerName: params.travelerName,
        travelerPhone: params.travelerPhone,
        travelerEmail: params.travelerEmail,
        passengersCount: hold.passengersCount,
        pickupLocation: params.pickupLocation,
        dropoffLocation: params.dropoffLocation,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        flightNumber: params.flightNumber,
        specialRequests: params.specialRequests,
        confirmationCode,
        assignedResource: undefined,
        createdAt: now,
        updatedAt: now
      };

      db.bookings.push(booking);

      // 4. Create / Update Trip Item
      const trip = db.trips.find(t => t.id === params.tripId);
      const tripItemId = `ITEM-TRF-${Date.now()}`;
      db.tripItems.push({
        id: tripItemId,
        tripId: params.tripId,
        serviceType: 'transfer',
        skuId: hold.skuId,
        title: `${sku.title} (${params.scheduledTime})`,
        dayNumber: 1,
        timeSlot: params.scheduledTime,
        priceEGP: hold.amountEGP,
        status: 'CONFIRMED',
        bookingId: booking.id,
        metadata: {
          pickupLocation: params.pickupLocation,
          dropoffLocation: params.dropoffLocation,
          flightNumber: params.flightNumber
        },
        createdAt: now,
        updatedAt: now
      });

      if (trip) {
        trip.totalPaidEGP += hold.amountEGP;
        trip.updatedAt = now;
      }

      // 5. Create Live Telemetry Entity — unassigned until supplier accepts
      const telemetry: TransferTelemetryEntity = {
        bookingId: booking.id,
        referenceCode: booking.bookingRef,
        driverName: undefined as any,
        driverNameAr: undefined as any,
        driverPhone: undefined as any,
        vehicleModel: undefined as any,
        vehiclePlate: undefined as any,
        pickupLocation: params.pickupLocation,
        dropoffLocation: params.dropoffLocation,
        scheduledTime: params.scheduledTime,
        flightNumber: params.flightNumber || '',
        flightStatus: 'ON_TIME',
        status: 'ASSIGNED',
        lastGpsUpdate: 'Awaiting supplier assignment',
        updatedAt: now
      };

      db.transferTelemetry.push(telemetry);

      // 6. Notify Supplier and Traveler
      notificationService.sendNotification({
        userId: params.travelerEmail,
        type: 'BOOKING_CREATED',
        title: 'Sharm ↔ Dahab Transfer Confirmed!',
        message: `Your transfer ${bookingRef} is confirmed. A driver will be assigned shortly. Meet at ${params.pickupLocation}.`,
        channel: 'WHATSAPP'
      });

      db.logAudit(params.travelerName, 'Traveler', 'BOOKING_COMPLETED', 'Booking', booking.id, {
        bookingRef: booking.bookingRef,
        amountEGP: booking.amountEGP,
        paymentId: paymentResult.payment.id
      });

      return { booking, telemetry };
    });
  }

  /**
   * Live transfer telemetry for a booking, or an honest "not assigned yet".
   *
   * The route used to answer an unknown booking with a canned record —
   * "Mahmoud Salem", +20 100 876 5432, a white HiAce, plate ط ج د 4821,
   * DISPATCHED two minutes ago — for any id at all. A booking nobody has
   * dispatched has no driver, and says so. `assigned` is false for stored
   * records the supplier has not yet filled in too.
   */
  public telemetryFor(bookingId: string): Omit<TransferTelemetryEntity, 'driverName' | 'driverPhone' | 'vehicleModel' | 'vehiclePlate' | 'status' | 'lastGpsUpdate' | 'flightStatus' | 'pickupLocation' | 'dropoffLocation' | 'scheduledTime' | 'updatedAt'> & {
    assigned: boolean;
    status: TransferTelemetryEntity['status'] | 'NOT_ASSIGNED';
    driverName: string | null;
    driverPhone: string | null;
    vehicleModel: string | null;
    vehiclePlate: string | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    scheduledTime: string | null;
    flightStatus: TransferTelemetryEntity['flightStatus'] | null;
    lastGpsUpdate: string | null;
    updatedAt: string | null;
  } {
    transferHubService.assignDueDrivers();
    const record = db.transferTelemetry.find(t => t.bookingId === bookingId || t.referenceCode === bookingId);
    if (record) {
      return { ...record, assigned: Boolean(record.driverName || record.driverPhone) };
    }
    const booking = db.bookings.find(b => b.id === bookingId || b.bookingRef === bookingId);
    return {
      bookingId,
      referenceCode: booking?.bookingRef ?? bookingId,
      assigned: false,
      status: 'NOT_ASSIGNED',
      driverName: null,
      driverNameAr: undefined,
      driverPhone: null,
      vehicleModel: null,
      vehiclePlate: null,
      pickupLocation: booking?.pickupLocation ?? null,
      dropoffLocation: booking?.dropoffLocation ?? null,
      scheduledTime: booking?.scheduledTime ?? null,
      flightNumber: booking?.flightNumber,
      flightStatus: null,
      lastGpsUpdate: null,
      updatedAt: null
    };
  }

  public updateSupplierStatus(bookingId: string, supplierState: BookingEntity['supplierState'], resource?: any): BookingEntity {
    const booking = db.bookings.find(b => b.id === bookingId || b.bookingRef === bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);
    // Validated here, not only in the route, so no caller can skip a step.
    assertTransition(booking.supplierState, supplierState);

    return db.runInTransaction(() => {
      booking.supplierState = supplierState;
      // Reaching COMPLETED settles the money side exactly as /respond COMPLETE
      // does. This path used to complete bookings with no payout at all.
      if (supplierState === 'COMPLETED') {
        supplierService.settleCompletion(booking);
      }
      if (resource) {
        booking.assignedResource = { ...booking.assignedResource, ...resource };
      }
      booking.updatedAt = new Date().toISOString();

      const telemetry = db.transferTelemetry.find(t => t.bookingId === booking.id || t.referenceCode === booking.bookingRef);
      if (telemetry) {
        if (supplierState === 'DISPATCHED') telemetry.status = 'DISPATCHED';
        if (supplierState === 'EN_ROUTE') telemetry.status = 'EN_ROUTE';
        if (supplierState === 'IN_PROGRESS') telemetry.status = 'PASSENGER_PICKED_UP';
        if (supplierState === 'ARRIVED') telemetry.status = 'ARRIVED';
        if (supplierState === 'COMPLETED') telemetry.status = 'COMPLETED';
        telemetry.updatedAt = new Date().toISOString();
      }

      db.logAudit('Supplier', 'Supplier', 'BOOKING_STATUS_MUTATED', 'Booking', booking.id, {
        newState: supplierState
      });

      return booking;
    });
  }
}

export const transferService = new TransferService();
