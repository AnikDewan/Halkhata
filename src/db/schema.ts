import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt: integer("created_at")
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [
    // Names are user-facing, so prevent casing and leading/trailing spaces from
    // producing what appears to be the same customer twice.
    uniqueIndex("customers_name_unique").on(sql`lower(trim(${table.name}))`),
  ],
);

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  type: text("type").$type<"given" | "received">().notNull(),
  amount: integer("amount").notNull(), // Whole rupees (e.g. ₹10 = 10). No paise/fractional amounts.
  description: text("description"),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
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
