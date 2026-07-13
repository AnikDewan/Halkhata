import { ActionFab } from "@/components/action-fab";
import { AppHeader } from "@/components/app-header";
import { SearchField } from "@/components/search-field";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import { WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";

export default function CustomersScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const customersQuery = db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
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
    .groupBy(customers.id)
    .orderBy(customers.name);

  const { data: customerList = [] } = useLiveQuery(customersQuery);

  const filteredCustomers = customerList.filter((c) => {
    return matchesSearch(searchQuery, [c.name, c.phone]);
  });

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Customers"
        subtitle="Search names in বাংলা or English"
      />

      <View className="flex-1 px-4 pt-4">
        <View className="mb-4">
          <SearchField
            placeholder="Search customer by name or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {filteredCustomers.length === 0 ? (
          <Animated.View
            entering={FadeIn.duration(400)}
            className="flex-1 items-center justify-center p-8 bg-background"
            style={{ borderCurve: "continuous" }}
          >
            <View className="h-14 w-14 rounded-full bg-primary items-center justify-center mb-4">
              <Users size={24} color={WHITE} />
            </View>
            <Text className="text-foreground font-bold text-base">
              No customers found
            </Text>
            <Text className="text-muted text-xs text-center mt-1.5 max-w-60">
              {searchQuery
                ? "Try a different search term."
                : "Tap the '+' button below to add customers manually or import from phone contacts."}
            </Text>
          </Animated.View>
        ) : (
          <View className="flex-1 mb-20" style={{ minHeight: 200 }}>
            <FlashList
              data={filteredCustomers}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item, index }) => {
                const balance = item.totalGiven - item.totalReceived;
                return (
                  <Animated.View
                    entering={FadeInDown.duration(350).delay(index * 30)}
                    layout={LinearTransition.springify()}
                  >
                    <Pressable
                      onPress={() => router.push(`/customer/${item.id}` as any)}
                      className="flex-row justify-between items-center bg-card border border-border rounded-2xl mb-2.5 overflow-hidden active:bg-border shadow-xs"
                      style={{ borderCurve: "continuous" }}
                    >
                      <View
                        className={cn(
                          "w-1.5 h-16",
                          balance === 0
                            ? "bg-transparent"
                            : balance > 0
                              ? "bg-danger"
                              : "bg-success",
                        )}
                      />

                      <View className="h-10 w-10 rounded-full bg-primary items-center justify-center ml-3 mr-3 shadow-xs">
                        <Text className="text-white font-bold text-xs">
                          {getInitials(item.name)}
                        </Text>
                      </View>

                      <View className="flex-1 py-3">
                        <Text className="text-foreground font-bold text-sm">
                          {item.name}
                        </Text>
                        {item.phone && (
                          <Text className="text-muted text-xs mt-0.5 font-medium">
                            {item.phone}
                          </Text>
                        )}
                      </View>

                      <View className="items-end py-3 px-4">
                        {balance === 0 ? (
                          <Text className="text-muted text-xs font-bold">
                            Settled
                          </Text>
                        ) : (
                          <>
                            <Text
                              className={cn(
                                "font-extrabold text-sm tabular-nums",
                                balance > 0 ? "text-danger" : "text-success",
                              )}
                            >
                              {balance > 0 ? "To Receive" : "To Give"}{" "}
                              {formatMoney(Math.abs(balance)).replace(
                                /[^\d.,]/g,
                                "",
                              )}
                            </Text>
                            <Text className="text-muted text-[10px] mt-1 font-semibold">
                              {balance > 0 ? "Pending" : "We owe"}
                            </Text>
                          </>
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              }}
            />
          </View>
        )}
      </View>

      <ActionFab onPress={() => router.push("/customer/add")} />
    </View>
  );
}
