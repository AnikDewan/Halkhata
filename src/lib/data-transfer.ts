import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";

type CustomerExport = typeof customers.$inferSelect;
type TransactionExport = typeof transactions.$inferSelect;

export type LedgerExport = {
  app: "HalKhata";
  version: 1;
  exportedAt: string;
  customers: CustomerExport[];
  transactions: TransactionExport[];
};

export async function buildLedgerExport(): Promise<LedgerExport> {
  const customerRows = await db.select().from(customers).orderBy(customers.name);
  const transactionRows = await db
    .select()
    .from(transactions)
    .orderBy(transactions.createdAt);

  return {
    app: "HalKhata",
    version: 1,
    exportedAt: new Date().toISOString(),
    customers: customerRows,
    transactions: transactionRows,
  };
}

function assertImportShape(value: unknown): asserts value is LedgerExport {
  if (!value || typeof value !== "object") {
    throw new Error("Import file must be a JSON object.");
  }

  const data = value as Partial<LedgerExport>;
  if (!Array.isArray(data.customers) || !Array.isArray(data.transactions)) {
    throw new Error("JSON must include customers and transactions arrays.");
  }
}

export async function importLedgerJson(rawJson: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("File is not valid JSON.");
  }
  assertImportShape(parsed);

  if (parsed.app && parsed.app !== "HalKhata") {
    throw new Error("This file does not look like a HalKhata backup.");
  }

  let importedCustomers = 0;
  let importedTransactions = 0;

  await db.transaction(async (tx) => {
    await tx.delete(transactions);
    await tx.delete(customers);

    for (const customer of parsed.customers) {
      const name = String(customer.name ?? "").trim();
      if (!name) continue;

      await tx.insert(customers).values({
        id: Number(customer.id),
        name,
        phone: customer.phone ? String(customer.phone) : null,
        createdAt: Number(customer.createdAt) || Date.now(),
      });
      importedCustomers += 1;
    }

    const validCustomerIds = new Set(
      parsed.customers.map((c) => Number(c.id)).filter((id) => Number.isFinite(id)),
    );
    for (const entry of parsed.transactions) {
      const customerId = Number(entry.customerId);
      if (!validCustomerIds.has(customerId)) {
        continue;
      }

      const amount = Number(entry.amount) || 0;
      if (amount <= 0) continue;

      await tx.insert(transactions).values({
        id: Number(entry.id),
        customerId,
        type: entry.type === "received" ? "received" : "given",
        amount,
        description: entry.description ? String(entry.description) : null,
        createdAt: Number(entry.createdAt) || Date.now(),
      });
      importedTransactions += 1;
    }
  });

  return {
    customerCount: importedCustomers,
    transactionCount: importedTransactions,
  };
}

export async function deleteCustomer(customerId: number) {
  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.customerId, customerId));
    await tx.delete(customers).where(eq(customers.id, customerId));
  });
}
