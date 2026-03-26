import { prisma } from "../../../config/prisma";
import { NotFoundError } from "../../../utils/errors/app.error";
import type {
  CustomerWalletDTO,
  CustomerWalletTransactionsResponseDTO,
} from "./customer-wallet.types";

export class CustomerWalletService {

  static async getWallet(userId: string): Promise<CustomerWalletDTO> {
    const customer = await prisma.customer.findUnique({
      where:   { user_id: userId },
      include: { wallet: true },
    });
    if (!customer) throw new NotFoundError("Customer profile not found.");

    const wallet = customer.wallet;

    return {
      id:               wallet?.id            ?? "not-created",
      balance:          wallet?.balance        ?? 0,
      currency:         wallet?.currency       ?? "INR",
      lifetime_spent:   wallet?.lifetime_spent  ?? 0,
      lifetime_refunds: wallet?.lifetime_refunds ?? 0,
      total_bookings:     customer.total_bookings,
      completed_bookings: customer.completed_bookings,
      total_spent_inr:    Math.round((wallet?.lifetime_spent ?? 0) / 100),
    };
  }

  static async getTransactions(
    userId:  string,
    page  = 1,
    limit = 20
  ): Promise<CustomerWalletTransactionsResponseDTO> {

    const customer = await prisma.customer.findUnique({
      where:   { user_id: userId },
      include: { wallet: true },
    });
    if (!customer) throw new NotFoundError("Customer profile not found.");

    if (!customer.wallet) {
      return {
        wallet: {
          id:               "not-created",
          balance:          0,
          currency:         "INR",
          lifetime_spent:   0,
          lifetime_refunds: 0,
          total_bookings:     customer.total_bookings,
          completed_bookings: customer.completed_bookings,
          total_spent_inr:    0,
        },
        transactions: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const walletId = customer.wallet.id;
    const skip     = (page - 1) * limit;

    const [txns, total] = await Promise.all([
      prisma.customerWalletTransaction.findMany({
        where:   { wallet_id: walletId },
        orderBy: { created_at: "desc" },
        skip,
        take:    limit,
        include: {
        },
      }),
      prisma.customerWalletTransaction.count({
        where: { wallet_id: walletId },
      }),
    ]);

    const bookingIds = txns
      .map((t) => t.booking_id)
      .filter((id): id is string => !!id);

    const bookings = bookingIds.length
      ? await prisma.booking.findMany({
          where:   { id: { in: bookingIds } },
          select:  {
            id:             true,
            booking_number: true,
            business:       { select: { business_name: true } },
          },
        })
      : [];

    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    const transactions = txns.map((t) => {
      const booking = t.booking_id ? bookingMap.get(t.booking_id) : null;
      return {
        id:            t.id,
        type:          t.type as "BOOKING_PAYMENT" | "REFUND" | "CREDIT",
        amount:        t.amount,
        balance_after: t.balance_after,
        description:   t.description,
        booking_id:    t.booking_id,
        created_at:    t.created_at,
        booking:       booking
          ? {
              booking_number: booking.booking_number,
              business_name:  booking.business.business_name,
            }
          : null,
      };
    });

    return {
      wallet: {
        id:               customer.wallet.id,
        balance:          customer.wallet.balance,
        currency:         customer.wallet.currency,
        lifetime_spent:   customer.wallet.lifetime_spent,
        lifetime_refunds: customer.wallet.lifetime_refunds,
        total_bookings:     customer.total_bookings,
        completed_bookings: customer.completed_bookings,
        total_spent_inr:    Math.round(customer.wallet.lifetime_spent / 100),
      },
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
