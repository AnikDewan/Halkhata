import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  type: text('type').$type<'given' | 'received'>().notNull(),
  amount: integer('amount').notNull(), // Whole rupees (e.g. ₹10 = 10). No paise/fractional amounts.
  description: text('description'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const customersRelations = relations(customers, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
}));
