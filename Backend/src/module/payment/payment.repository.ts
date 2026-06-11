import { prisma } from "../../config/prisma";

export class PaymentRepository {

  static async findBookingForPayment(bookingId: string) {
    return prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id:           true,
        customer_id:  true,
        business_id:  true,
        staff_id:     true,
        status:       true,
        service_amount: true,
        version: true,
      },
    });
  }

  static async findPaymentByBooking(bookingId: string) {
    return prisma.payment.findUnique({
      where:  { booking_id: bookingId },
      select: {
        id:                  true,
        status:              true,
        amount:              true,
        currency: true,
        razorpay_order_id:   true,
        razorpay_payment_id: true,
        settle_after:        true,
        refund_status: true,   // ✅ ADD
        refund_amount: true, 
      },
    });
  }

  static async updatePaymentOrderId(paymentId: string, orderId: string) {
    return prisma.payment.update({
      where: { id: paymentId },
      data:  { razorpay_order_id: orderId },
    });
  }

  static async findBookingWithRelations(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId }, // ⚠️ Status must be validated in service (PENDING_PAYMENT or CONFIRMED only)
      include: {
        customer: {
          select: {
            id:   true,
            name: true,
            user: { select: { id: true, email: true } },
          },
        },
        business: {
          select: {
            id:                       true,
            business_name:            true,
            cancellation_window_hours: true,
            owner: { select: { user: { select: { id: true } } } },
          },
        },
        staff: {
          select: {
            id:   true,
            name: true,
            user: { select: { id: true } },
          },
        },
        payment: {
  select: {
    id: true,
    status: true,
    amount: true,

    razorpay_payment_id: true, // ✅ ADD
    razorpay_order_id: true,   // ✅ ADD

    refund_status: true,       // ✅ ADD
    refund_amount: true,       // ✅ ADD

    paid_at: true,             // ✅ ADD
    settled_at: true,          // ✅ ADD
  },
},
        qr_code: {
          select: {
            qr_image_url: true,
            expires_at:   true,
            qr_status:    true,

            is_used: true,  // ✅ ADD
    used_at: true,
          },
        },
      },
    });
  }
}
