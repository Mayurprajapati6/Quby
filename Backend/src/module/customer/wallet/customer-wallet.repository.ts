import { prisma } from "../../../config/prisma";

export class CustomerWalletRepository {

  static async findByCustomerId(customerId: string) {
    return prisma.customerWallet.findUnique({
      where: { customer_id: customerId },
    });
  }

  static async findTransactions(
    walletId: string,
    skip:     number,
    take:     number
  ) {
    const [transactions, total] = await Promise.all([
      prisma.customerWalletTransaction.findMany({
        where:   { wallet_id: walletId },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.customerWalletTransaction.count({ where: { wallet_id: walletId } }),
    ]);
    return { transactions, total };
  }

  static async findTransactionBookingIds(bookingIds: string[]) {
    if (!bookingIds.length) return [];
    return prisma.booking.findMany({
      where:  { id: { in: bookingIds } },
      select: {
        id:             true,
        booking_number: true,
        business:       { select: { business_name: true } },
      },
    });
  }

  static async credit(
    customerId:  string,
    amount:      number,
    description: string,
    bookingId?:  string,
    txnId?:      string
  ) {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.upsert({
        where:  { customer_id: customerId },
        create: { customer_id: customerId, balance: amount, lifetime_refunds: amount },
        update: {
          balance:          { increment: amount },
          lifetime_refunds: { increment: amount },
        },
      });

      await tx.customerWalletTransaction.create({
        data: {
          wallet_id:      wallet.id,
          type:           "REFUND",
          amount,
          balance_after:  wallet.balance,
          description,
          booking_id:     bookingId ?? null,
          transaction_id: txnId    ?? null,
        },
      });

      return wallet;
    });
  }

  static async debit(
    customerId:  string,
    amount:      number,
    description: string,
    bookingId?:  string
  ) {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.update({
        where: { customer_id: customerId },
        data:  {
          balance:        { decrement: amount },
          lifetime_spent: { increment: amount },
        },
      });

      await tx.customerWalletTransaction.create({
        data: {
          wallet_id:     wallet.id,
          type:          "BOOKING_PAYMENT",
          amount:        -amount,
          balance_after: wallet.balance,
          description,
          booking_id:    bookingId ?? null,
        },
      });

      return wallet;
    });
  }
}
