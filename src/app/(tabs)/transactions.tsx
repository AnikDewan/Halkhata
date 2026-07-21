import { ActionFab } from "@/components/action-fab";
import { AppHeader } from "@/components/app-header";
import { SearchField } from "@/components/search-field";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useRouter } from "expo-router";
import { ArrowDown, ArrowUp, FileSpreadsheet } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type FilterType = "all" | "given" | "received";
type TimeFilter = "all" | "today" | "week" | "month";

export default function TransactionsFeedScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const transactionsQuery = db
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
    .orderBy(sql`${transactions.createdAt} DESC`);

  const { data: allTransactions = [] } = useLiveQuery(transactionsQuery);

  const filteredTransactions = allTransactions.filter((item) => {
    const matchesSearchQuery = matchesSearch(searchQuery, [
      item.customerName,
      item.description,
    ]);

    const matchesType = typeFilter === "all" || item.type === typeFilter;

    let matchesTime = true;
    if (timeFilter !== "all") {
      const now = new Date();

      if (timeFilter === "today") {
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).getTime();
        matchesTime = item.createdAt >= todayStart;
      } else if (timeFilter === "week") {
        const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        matchesTime = item.createdAt >= weekAgo;
      } else if (timeFilter === "month") {
        const monthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
        matchesTime = item.createdAt >= monthAgo;
      }
    }

    return matchesSearchQuery && matchesType && matchesTime;
  });

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Transactions" subtitle="Filter every ledger entry" />

      <View className="flex-1 px-4 pt-4">
        <View className="mb-4">
          <SearchField
            placeholder="Search entries by customer or description..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View
          className="flex-row bg-card border border-border p-1 rounded-2xl mb-3 shadow-xs"
          style={{ borderCurve: "continuous" }}
        >
          {(["all", "given", "received"] as FilterType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setTypeFilter(type)}
              className={cn(
                "flex-1 py-2.5 rounded-xl items-center active:opacity-80",
                typeFilter === type ? "bg-primary" : "bg-transparent",
              )}
              style={{ borderCurve: "continuous" }}
            >
              <Text
                className={cn(
                  "text-xs font-extrabold capitalize",
                  typeFilter === type
                    ? "text-white"
                    : "text-foreground-secondary",
                )}
              >
                {type === "all"
                  ? "All"
                  : type === "given"
                    ? "Given"
                    : "Received"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-2 mb-4">
          {(["all", "today", "week", "month"] as TimeFilter[]).map((time) => {
            const labels = {
              all: "All Time",
              today: "Today",
              week: "This Week",
              month: "This Month",
            };
            return (
              <Pressable
                key={time}
                onPress={() => setTimeFilter(time)}
                className={cn(
                  "py-2 px-3.5 rounded-xl border active:opacity-85 shadow-xs",
                  timeFilter === time
                    ? "bg-primary border-primary/20"
                    : "bg-card border-border",
                )}
                style={{ borderCurve: "continuous" }}
              >
                <Text
                  className={cn(
                    "text-xxs font-bold",
                    timeFilter === time
                      ? "text-white"
                      : "text-foreground-secondary",
                  )}
                >
                  {labels[time]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filteredTransactions.length === 0 ? (
          <Animated.View
            entering={FadeIn.duration(400)}
            className="flex-1 items-center justify-center p-8 bg-background rounded-3xl mb-6"
            style={{ borderCurve: "continuous" }}
          >
            <View className="h-14 w-14 rounded-full bg-primary items-center justify-center mb-4">
              <FileSpreadsheet size={24} color={WHITE} />
            </View>
            <Text className="text-foreground font-bold text-base">
              No entries found
            </Text>
            <Text className="text-muted text-xs text-center mt-1.5 max-w-60">
              {allTransactions.length === 0
                ? "Transactions will appear here once added in the Customers tab."
                : "Try adjusting your filters or search query."}
            </Text>
          </Animated.View>
        ) : (
          <View className="flex-1 mb-2" style={{ minHeight: 200 }}>
            <FlashList
              data={filteredTransactions}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    router.push(`/customer/${item.customerId}` as any)
                  }
                  className="flex-row justify-between items-center bg-card border border-border rounded-2xl mb-2.5 overflow-hidden active:bg-border shadow-xs"
                  style={{ borderCurve: "continuous" }}
                >
                    <View
                      className={cn(
                        "w-1.5 h-16",
                        item.type === "given" ? "bg-danger" : "bg-success",
                      )}
                    />

                    <View className="flex-1 py-3 px-3">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="text-foreground font-bold text-sm">
                          {item.customerName}
                        </Text>
                      </View>
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
                          <ArrowUp size={11} color={c.danger} strokeWidth={3} />
                        ) : (
                          <ArrowDown
                            size={11}
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
                      <Text className="text-muted text-xxs mt-1 font-semibold">
                        {formatDate(item.createdAt)}
                      </Text>
                    </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <ActionFab onPress={() => router.push("/transaction/add")} />
    </View>
  );
}
