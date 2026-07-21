import { AppHeader } from "@/components/app-header";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Link, useRouter } from "expo-router";
import { ArrowDown, ArrowUp, Inbox } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function HomeDashboard() {
  const router = useRouter();
  const c = useThemeColors();

  // Query all customer summaries to calculate aggregate metrics
  const customersQuery = db
    .select({
      id: customers.id,
      totalGiven:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'given' THEN ${transactions.amount} ELSE 0 END), 0)`.mapWith(
          Number,
        ),
      totalReceived:
        sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'received' THEN ${transactions.amount} ELSE 0 END), 0)`.mapWith(
          Number,
        ),
    })
    .from(customers)
    .leftJoin(transactions, sql`${customers.id} = ${transactions.customerId}`)
    .groupBy(customers.id);

  const { data: customerSums = [] } = useLiveQuery(customersQuery);

  // Compute receivables, payables and net balance
  let totalReceivable = 0; // sum of positive balances
  let totalPayable = 0; // sum of absolute negative balances

  customerSums.forEach((c) => {
    const balance = c.totalGiven - c.totalReceived;
    if (balance > 0) {
      totalReceivable += balance;
    } else if (balance < 0) {
      totalPayable += Math.abs(balance);
    }
  });

  const netBalance = totalReceivable - totalPayable;

  // Query recent 5 transactions
  const recentTransactionsQuery = db
    .select({
      id: transactions.id,
      customerId: transactions.customerId,
      customerName: customers.name,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(customers, sql`${transactions.customerId} = ${customers.id}`)
    .orderBy(sql`${transactions.createdAt} DESC`)
    .limit(5);

  const { data: recentTransactions = [] } = useLiveQuery(
    recentTransactionsQuery,
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="HalKhata" subtitle="Digital ledger" />

      <View className="flex-1 px-4 pt-4">
        {/* Net Summary Card (Overhauled with premium brand red gradient) */}
        <Animated.View
          entering={FadeInDown.duration(450).delay(100)}
          className={cn(
            "bg-linear-to-br from-primary to-red-800 rounded-3xl p-6 mb-6 shadow-md overflow-hidden relative",
            netBalance < 0 ? "bg-card border border-border" : "bg-primary",
          )}
          style={{ borderCurve: "continuous" }}
        >
          {/* Subtle background circles for organic premium look */}
          <View className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5" />
          <View className="absolute -left-10 -bottom-10 w-28 h-28 rounded-full bg-white/5" />
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-bold uppercase tracking-wider text-white">
              {netBalance < 0 ? "Net Debt" : "Net Outstanding"}
            </Text>
          </View>

          <Text className="text-4xl font-black mt-2 tracking-tight tabular-nums text-white">
            {formatMoney(Math.abs(netBalance))}
          </Text>

          <Text className="text-xs mt-1.5 font-medium text-white">
            {netBalance >= 0
              ? "Net amount you will receive"
              : "Net amount you owe"}
          </Text>

          <View className="flex-row border-t mt-6 pt-5 justify-content border-white/60">
            <View className="flex-1 pr-2">
              <Text className="text-xs font-bold uppercase tracking-wider text-white">
                Given
              </Text>
              <Text className="text-xl font-extrabold mt-1 tabular-nums text-white">
                {formatMoney(totalReceivable)}
              </Text>
            </View>

            <View className="flex-1 pl-4 border-l border-white/60">
              <Text className="text-xs font-bold uppercase tracking-wider text-white">
                Received
              </Text>
              <Text className="text-xl font-extrabold mt-1 tabular-nums text-white">
                {formatMoney(totalPayable)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Recent Transactions Section */}
        <View className="flex-1">
          <Animated.View
            entering={FadeInDown.duration(450).delay(300)}
            className="flex-row justify-between items-center mb-4"
          >
            <Text className="text-foreground text-lg font-bold">
              Recent Entries
            </Text>
            {recentTransactions.length > 0 && (
              <Link href="/transactions" asChild>
                <Pressable className="active:opacity-60 py-1 px-2">
                  <Text className="text-primary text-xs font-bold">
                    View All
                  </Text>
                </Pressable>
              </Link>
            )}
          </Animated.View>

          {recentTransactions.length === 0 ? (
            <Animated.View
              entering={FadeInDown.duration(450).delay(350)}
              className="flex-1 items-center justify-center bg-background p-8"
              style={{ borderCurve: "continuous" }}
            >
              <View className="h-14 w-14 rounded-full bg-primary items-center justify-center mb-4">
                <Inbox size={26} color={WHITE} />
              </View>
              <Text className="text-foreground font-bold text-base">
                No entries recorded
              </Text>
              <Text className="text-muted text-xs text-center mt-1.5 max-w-60">
                Tap + to add a customer and record your first ledger
                transaction.
              </Text>
            </Animated.View>
          ) : (
            <View className="flex-1 mb-2" style={{ minHeight: 150 }}>
              <FlashList
                data={recentTransactions}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() =>
                      router.push(`/customer/${item.customerId}` as any)
                    }
                    className="flex-row justify-between items-center bg-card border border-border rounded-2xl mb-2.5 overflow-hidden active:bg-border shadow-xs"
                    style={{ borderCurve: "continuous" }}
                  >
                      {/* Visual left colored strip matching transaction type */}
                      <View
                        className={cn(
                          "w-1.5 h-16",
                          item.type === "given" ? "bg-danger" : "bg-success",
                        )}
                      />

                      <View className="flex-1 py-3 px-3">
                        <Text className="text-foreground font-bold text-sm">
                          {item.customerName}
                        </Text>
                        <Text
                          className="text-muted text-xs mt-1"
                          numberOfLines={1}
                        >
                          {item.description ||
                            (item.type === "given" ? "Given" : "Received")}
                        </Text>
                      </View>
                      <View className="items-end py-3 px-4">
                        <View className="flex-row items-center gap-1">
                          {item.type === "given" ? (
                            <ArrowUp
                              size={12}
                              color={c.danger}
                              strokeWidth={3}
                            />
                          ) : (
                            <ArrowDown
                              size={12}
                              color={c.success}
                              strokeWidth={3}
                            />
                          )}
                          <Text
                            className={cn(
                              "font-extrabold text-sm tabular-nums",
                              item.type === "given"
                                ? "text-danger"
                                : "text-success",
                            )}
                          >
                            {formatMoney(item.amount).replace(/[^\d.,]/g, "")}
                          </Text>
                        </View>
                        <Text className="text-muted text-[10px] mt-1 font-semibold">
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
