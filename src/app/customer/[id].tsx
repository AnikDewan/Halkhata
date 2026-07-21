import { ActionFab } from "@/components/action-fab";
import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { deleteCustomer } from "@/lib/data-transfer";
import { shareReminderPdf } from "@/lib/pdf";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { desc, eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowDown,
  ArrowUp,
  Inbox,
  Phone,
  Share2,
  Trash2,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";
import { db } from "../../db/db";
import { customers, transactions } from "../../db/schema";
import { cn } from "../../lib/cn";
import { formatDate, formatMoney } from "../../lib/format";

export default function CustomerDetailsScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
  const { id } = useLocalSearchParams();
  const customerId = Number(id);
  const c = useThemeColors();

  const customerQuery = db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  const { data: customerData = [] } = useLiveQuery(customerQuery);
  const customer = customerData[0];

  const txQuery = db
    .select()
    .from(transactions)
    .where(eq(transactions.customerId, customerId))
    .orderBy(desc(transactions.createdAt));
  const { data: txList = [] } = useLiveQuery(txQuery);

  if (!customer) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <ActivityIndicator size="large" colorClassName="accent-primary" />
        <Text className="text-foreground mt-4 font-semibold">
          Loading customer record...
        </Text>
      </View>
    );
  }

  let totalGiven = 0;
  let totalReceived = 0;
  txList.forEach((t) => {
    if (t.type === "given") {
      totalGiven += t.amount;
    } else {
      totalReceived += t.amount;
    }
  });

  const balance = totalGiven - totalReceived;

  const handleDeleteTransaction = (
    txId: number,
    txAmount: number,
    type: "given" | "received",
  ) => {
    const actionLabel = type === "given" ? "Given" : "Received";
    alert(
      "Delete Ledger Entry",
      `Are you sure you want to delete this ${actionLabel} of ${formatMoney(txAmount)}? The customer's balance will adjust automatically.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await db.delete(transactions).where(eq(transactions.id, txId));
            } catch (e: any) {
              alert("Error", "Failed to delete entry: " + e.message);
            }
          },
        },
      ],
    );
  };

  const handleDeleteCustomer = () => {
    alert(
      "Delete Customer Account",
      `This will delete ${customer.name} and ALL their ledger history permanently. Do you wish to continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCustomer(customerId);
              router.back();
            } catch (e: any) {
              alert("Error", "Failed to delete customer: " + e.message);
            }
          },
        },
      ],
    );
  };

  const handleShareReminder = () => {
    shareReminderPdf({
      customerName: customer.name,
      customerPhone: customer.phone,
      balance,
    }).catch((e: any) =>
      alert("Error", "Could not generate reminder PDF: " + e.message),
    );
  };

  const handleCallCustomer = () => {
    if (!customer.phone) {
      alert(
        "No Phone Number",
        "Please add a phone number for this customer first.",
      );
      return;
    }
    const url = `tel:${customer.phone}`;
    Linking.openURL(url).catch(() => {
      alert("Error", "Could not open phone dialer.");
    });
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title={customer.name}
        subtitle="Customer ledger"
        back
        right={
          <Pressable
            onPress={handleDeleteCustomer}
            className="p-2.5 rounded-full bg-card border border-border active:bg-danger"
          >
            <Trash2 size={18} color={c.danger} />
          </Pressable>
        }
      />

      <View className="flex-1 px-4 pt-4">
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          className="bg-card border border-border rounded-3xl p-5 mb-5 shadow-xs"
          style={{ borderCurve: "continuous" }}
        >
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-2">
              <Text className="text-foreground text-xl font-bold">
                {customer.name}
              </Text>
              {customer.phone && (
                <Text
                  className="text-muted text-xs mt-2 font-semibold flex-row items-center gap-2"
                  onPress={handleCallCustomer}
                >
                  <Phone size={10} color={c.primary} /> {customer.phone}
                </Text>
              )}
            </View>
            <View className="items-end">
              <Text className="text-foreground-secondary text-xxs font-bold uppercase tracking-wider">
                Net Balance
              </Text>
              <Text
                className={cn(
                  "text-2xl font-black mt-1 tabular-nums",
                  balance === 0
                    ? "text-muted"
                    : balance > 0
                      ? "text-danger"
                      : "text-success",
                )}
              >
                {balance === 0 ? "Settled" : formatMoney(Math.abs(balance))}
              </Text>
              {balance !== 0 && (
                <Text className="text-muted text-[10px] mt-1 font-bold">
                  {balance > 0 ? "You will receive" : "You will give"}
                </Text>
              )}
            </View>
          </View>

          <View className="flex-row justify-between border-t border-border mt-5 pt-4">
            <View>
              <Text className="text-foreground-secondary text-[10px] font-bold uppercase tracking-wider">
                Given
              </Text>
              <Text className="text-danger text-sm font-extrabold mt-1">
                {formatMoney(totalGiven)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-foreground-secondary text-[10px] font-bold uppercase tracking-wider">
                Received
              </Text>
              <Text className="text-success text-sm font-extrabold mt-1">
                {formatMoney(totalReceived)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {balance > 0 && (
          <Animated.View
            entering={FadeInDown.duration(400).delay(150)}
            className="bg-card border border-border rounded-2xl p-4 mb-5 flex-row items-center justify-between shadow-xs"
            style={{ borderCurve: "continuous" }}
          >
            <View className="flex-1 pr-3">
              <Text className="text-foreground font-bold text-xs">
                Share Reminder
              </Text>
              <Text
                className="text-muted text-xxs mt-0.5 font-semibold"
                numberOfLines={1}
              >
                send a PDF reminder
              </Text>
            </View>
            <Pressable
              onPress={handleShareReminder}
              className="h-10 w-10 rounded-xl bg-primary items-center justify-center active:opacity-75"
            >
              <Share2 size={16} color={WHITE} strokeWidth={2.2} />
            </Pressable>
          </Animated.View>
        )}

        <Text className="text-foreground text-base font-bold mb-3">
          Ledger Entries
        </Text>

        {txList.length === 0 ? (
          <Animated.View
            entering={FadeInDown.duration(400).delay(200)}
            className="flex-1 items-center justify-center bg-background p-8"
            style={{ borderCurve: "continuous" }}
          >
            <View className="h-12 w-12 rounded-full bg-primary items-center justify-center mb-3">
              <Inbox size={20} color={WHITE} />
            </View>
            <Text className="text-foreground font-bold text-sm">
              No ledger logs yet
            </Text>
            <Text className="text-muted text-xs text-center mt-1">
              Tap the + button below to add given or received entries.
            </Text>
          </Animated.View>
        ) : (
          <View className="flex-1 mb-20" style={{ minHeight: 200 }}>
            <FlashList
              data={txList}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  onLongPress={() =>
                    handleDeleteTransaction(item.id, item.amount, item.type)
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
                        <Text className="text-muted text-xxs font-semibold">
                          {formatDate(item.createdAt)}
                        </Text>
                      </View>
                      {item.description && (
                        <Text
                          className="text-foreground-secondary text-xs mt-1.5 font-medium"
                          numberOfLines={1}
                        >
                          {item.description}
                        </Text>
                      )}
                    </View>

                    <View className="flex-row items-center gap-3.5 py-3 px-4">
                      <View className="flex-row items-center gap-1.5">
                        {item.type === "given" ? (
                          <ArrowUp size={14} color={c.danger} strokeWidth={3} />
                        ) : (
                          <ArrowDown
                            size={14}
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
                      <Pressable
                        onPress={() =>
                          handleDeleteTransaction(
                            item.id,
                            item.amount,
                            item.type,
                          )
                        }
                        className="p-2 rounded-xl active:bg-border/30"
                      >
                        <Trash2 size={13} color={c.danger} />
                      </Pressable>
                    </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>

      <ActionFab
        onPress={() =>
          router.push({
            pathname: "/transaction/add",
            params: { customerId: String(customerId) },
          } as any)
        }
      />
    </View>
  );
}
