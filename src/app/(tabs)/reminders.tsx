import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import { formatMoney } from "@/lib/format";
import { shareReminderPdf } from "@/lib/pdf";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { AlertCircle, CheckCircle2, Share2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function RemindersScreen() {
  const c = useThemeColors();
  const { alert } = useAppAlert();
  // Query customers and calculate sums
  const query = db
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

  const { data: rawList = [] } = useLiveQuery(query);

  // Keep only customers who owe money (balance > 0)
  const pendingCustomers = rawList
    .map((c) => ({
      ...c,
      balance: c.totalGiven - c.totalReceived,
    }))
    .filter((c) => c.balance > 0);

  // Share a PDF reminder
  const handleShareReminder = (
    name: string,
    phone: string | null,
    balance: number,
  ) => {
    shareReminderPdf({
      customerName: name,
      customerPhone: phone,
      balance,
    }).catch((e: any) =>
      alert("Error", "Could not generate reminder PDF: " + e.message),
    );
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Reminders" subtitle="Customers who owe you" back />

      <View className="px-4 pt-4 mb-5">
        <Text className="text-foreground font-semibold text-sm">
          Pending Dues
        </Text>
        <Text className="text-muted text-xs mt-1 font-semibold leading-relaxed">
          Here is a list of all customers who owe you money. Send them quick
          reminders as a shareable PDF.
        </Text>
      </View>

      {/* Reminders List */}
      {pendingCustomers.length === 0 ? (
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="flex-1 items-center justify-center bg-background rounded-3xl p-8 mx-4 mb-6 shadow-xs"
          style={{ borderCurve: "continuous" }}
        >
          <View className="h-14 w-14 rounded-full bg-success items-center justify-center mb-4">
            <CheckCircle2 size={24} color={WHITE} />
          </View>
          <Text className="text-foreground font-bold text-base">
            All clear!
          </Text>
          <Text className="text-muted text-xs text-center mt-1.5 font-semibold">
            No customers currently have outstanding balances.
          </Text>
        </Animated.View>
      ) : (
        <View className="flex-1 px-4 mb-4" style={{ minHeight: 200 }}>
          <FlashList
            data={pendingCustomers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View
                className="flex-row justify-between items-center bg-card border border-border p-4 rounded-2xl mb-2.5 shadow-xs"
                style={{ borderCurve: "continuous" }}
              >
                  <View className="flex-1 pr-2">
                    <Text className="text-foreground font-bold text-sm">
                      {item.name}
                    </Text>
                    {item.phone ? (
                      <Text className="text-muted text-xs mt-0.5 font-semibold">
                        {item.phone}
                      </Text>
                    ) : (
                      <View className="flex-row items-center gap-1 mt-1">
                        <AlertCircle size={10} color={c.danger} />
                        <Text className="text-danger text-[9px] font-extrabold uppercase tracking-wide">
                          No phone number
                        </Text>
                      </View>
                    )}
                    <Text className="text-danger text-sm font-black mt-2.5 tabular-nums">
                      Pending: {formatMoney(item.balance)}
                    </Text>
                  </View>

                  {/* Reminder Actions */}
                  <View className="flex-row gap-2.5">
                    <Pressable
                      onPress={() =>
                        handleShareReminder(item.name, item.phone, item.balance)
                      }
                      className="h-10 w-10 rounded-xl bg-primary items-center justify-center active:opacity-75"
                    >
                      <Share2 size={16} color={WHITE} strokeWidth={2.2} />
                    </Pressable>
                  </View>
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}
