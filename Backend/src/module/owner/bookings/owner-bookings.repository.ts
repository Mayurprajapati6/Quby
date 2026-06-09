/**
 * owner/bookings/owner-bookings.repository.ts
 *
 * CHANGES vs original (document 9):
 *   ✅ service_started_at included in findMany select for list
 *      (owner card shows "Awaiting Check-In" vs "In Progress" badge based on this)
 *   ✅ service_completed_at included (actual_end_time on card)
 *   ✅ checked_in_at included (timeline row in detail modal)
 *   ✅ actual_duration included (timeline row)
 *   ✅ running tab: sort awaiting-first (service_started_at nulls first), then in-progress
 *   ✅ cancelled_at included in list (refund tab timeline)
 *   ✅ cancellable_until included in list (cancel timer on upcoming/today card)
 *   Everything else preserved from production version.
 */

import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

export class OwnerBookingsRepository {

  static async find(opts: {
    businessIds:  string[];
    business_id?: string;
    tab: "running" | "today" | "upcoming" | "completed" | "no_show" | "refund";
    date?: string;
    page: number;
    limit: number;
  }) {
    const scope = opts.business_id
      ? [opts.business_id].filter(id => opts.businessIds.includes(id))
      : opts.businessIds;

    const now   = new Date();
    const start = startOfDay(now);
    const end   = new Date(start);
    end.setDate(end.getDate() + 1);

    let where: any = {
      business_id: { in: scope },
      is_visible:  { not: false },
      status:      { notIn: ["PENDING_PAYMENT", "EXPIRED"] },
      payment: {
        is: {
          status: { in: ["PAID", "SETTLED", "REFUNDED"] as any },
        },
      },
    };

    if (opts.date) {
      const dayStart = startOfDay(new Date(`${opts.date}T00:00:00+05:30`));
      const dayEnd   = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.service_date = { gte: dayStart, lt: dayEnd };
    }

    switch (opts.tab) {
      case "running":
        // ALL RUNNING — both awaiting check-in (service_started_at=null) and in-progress
        // Frontend card distinguishes sub-state via service_started_at field
        where.status = { in: ["RUNNING"] };
        break;
      case "today":
        if (!opts.date) where.service_date = { gte: start, lt: end };
        where.status = { in: ["CONFIRMED", "RUNNING"] };
        break;
      case "upcoming":
        if (!opts.date) where.service_date = { gte: end };
        where.status = "CONFIRMED";
        break;
      case "completed":
        where.status = "COMPLETED";
        break;
      case "no_show":
        where.status = "NO_SHOW";
        break;
      case "refund":
        where.status = { in: ["REFUND_INITIATED", "REFUNDED"] };
        break;
    }

    // ✅ Running: sort awaiting-first (nulls first = service hasn't started yet), then in-progress
    let orderBy: any = [{ created_at: "desc" }];
    if (opts.tab === "running") {
      orderBy = [
        { service_started_at: { sort: "asc", nulls: "first" } },
        { queue_number: "asc" },
      ];
    } else if (opts.tab === "today" || opts.tab === "upcoming") {
      orderBy = [{ service_start_time: "asc" }, { queue_number: "asc" }];
    } else if (opts.tab === "completed" || opts.tab === "no_show") {
      orderBy = [{ service_date: "desc" }, { service_start_time: "desc" }];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        select: {
          id:                  true,
          booking_number:      true,
          status:              true,
          service_date:        true,
          service_start_time:  true,
          estimated_duration:  true,
          queue_number:        true,
          service_amount:      true,
          services:            true,
          cancellation_reason: true,
          cancellable_until:   true,
          cancelled_at:        true,
          created_at:          true,
          // ✅ ADDED: drives "Awaiting Check-In" vs "In Progress" badge on owner card
          service_started_at:   true,
          service_completed_at: true,
          checked_in_at:        true,
          actual_duration:      true,
          customer: {
            select: { id: true, name: true, phone: true, avatar_url: true },
          },
          staff: {
            select: { id: true, name: true, avatar_url: true },
          },
          business: {
            select: { id: true, business_name: true, logo_url: true },
          },
          payment: {
            select: {
              id:            true,
              status:        true,
              amount:        true,
              refund_status: true,
              refund_amount: true,
            },
          },
          review: {
            select: { id: true, rating: true },
          },
        },
        orderBy,
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  static async findById(bookingId: string, businessIds: string[]) {
    return prisma.booking.findFirst({
      where: { id: bookingId, business_id: { in: businessIds } },
      select: {
        id:                  true,
        booking_number:      true,
        status:              true,
        service_date:        true,
        service_start_time:  true,
        estimated_duration:  true,
        queue_number:        true,
        service_amount:      true,
        services:            true,
        cancellation_reason: true,
        cancelled_at:        true,
        cancellable_until:   true,
        notes:               true,
        service_started_at:   true,
        service_completed_at: true,
        checked_in_at:        true,
        actual_duration:      true,
        customer: {
          select: { id: true, name: true, phone: true, avatar_url: true },
        },
        staff: {
          select: { id: true, name: true, avatar_url: true, phone: true },
        },
        business: {
          select: { id: true, business_name: true, logo_url: true },
        },
        qr_code: {
          select: { qr_image_url: true },
        },
        payment: {
          select: {
            id:                  true,
            status:              true,
            amount:              true,
            paid_at:             true,
            settled_at:          true,
            refund_status:       true,
            refund_amount:       true,
            refund_id:           true,
            razorpay_payment_id: true,
            razorpay_order_id:   true,
          },
        },
        review: {
          select: { id: true, rating: true, comment: true },
        },
      },
    });
  }
}