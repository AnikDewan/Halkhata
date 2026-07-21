import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { FormField } from "@/components/form-field";
import { SearchField } from "@/components/search-field";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import { cn } from "@/lib/cn";
import { parseRupees } from "@/lib/format";
import { matchesSearch } from "@/lib/search";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, Receipt } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";

export default function AddTransactionScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const initialCustomerId = params.customerId
    ? Number(params.customerId)
    : null;

  const [customerId, setCustomerId] = useState<number | null>(
    Number.isFinite(initialCustomerId) && initialCustomerId! > 0
      ? initialCustomerId
      : null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [txType, setTxType] = useState<"given" | "received">("given");
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const customersQuery = db.select().from(customers).orderBy(customers.name);
  const { data: customerList = [] } = useLiveQuery(customersQuery);

  const selectedCustomer = customerList.find((row) => row.id === customerId);

  // When a customerId was passed, also confirm they exist via live query
  const customerByIdQuery =
    customerId != null
      ? db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
      : db.select().from(customers).limit(0);
  const { data: customerById = [] } = useLiveQuery(customerByIdQuery);
  const customer = selectedCustomer ?? customerById[0];

  const filteredCustomers = customerList.filter((row) =>
    matchesSearch(customerSearch, [row.name, row.phone]),
  );

  const handleSave = async () => {
    if (!customerId) {
      alert("Select Customer", "Choose a customer before adding an entry.");
      return;
    }

    const amount = parseRupees(amountStr);
    if (amount == null) {
      alert("Invalid Amount", "Enter a valid positive amount in whole rupees.");
      return;
    }

    setSaving(true);
    try {
      await db.insert(transactions).values({
        customerId,
        type: txType,
        amount,
        description: description.trim() || null,
      });
      router.back();
    } catch (e: any) {
      alert("Error", "Failed to add entry: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBill = () => {
    if (!customerId) {
      alert(
        "Select Customer",
        "Choose a customer first, then create an itemized bill for them.",
      );
      return;
    }
    router.push({
      pathname: "/billing",
      params: { customerId: String(customerId) },
    } as any);
  };

  // Step 1: pick customer when none selected
  if (!customerId || !customer) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Add Entry" subtitle="Choose a customer first" back />

        <View className="px-4 pt-4 mb-3">
          <SearchField
            placeholder="Search customer..."
            value={customerSearch}
            onChangeText={setCustomerSearch}
          />
        </View>

        {filteredCustomers.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-muted text-sm font-bold text-center">
              {customerList.length === 0
                ? "Add a customer before recording a transaction."
                : "No matching customers found."}
            </Text>
            {customerList.length === 0 && (
              <Pressable
                onPress={() => router.push("/customer/add")}
                className="mt-4 py-3 px-5 rounded-2xl bg-primary active:opacity-85"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-white font-extrabold text-xs uppercase tracking-wider">
                  Add Customer
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View className="flex-1 px-4 mb-4" style={{ minHeight: 200 }}>
            <FlashList
              data={filteredCustomers}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                    onPress={() => setCustomerId(item.id)}
                    className="flex-row justify-between items-center bg-card border border-border p-4 rounded-2xl mb-2.5 active:bg-border shadow-xs"
                    style={{ borderCurve: "continuous" }}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-foreground font-bold text-sm">
                        {item.name}
                      </Text>
                      {item.phone && (
                        <Text className="text-muted text-xs font-semibold mt-1">
                          {item.phone}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={16} color={c.primary} />
                </Pressable>
              )}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Add Entry" subtitle={customer.name} back />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-5 pb-10 gap-5"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <View
            className="bg-card border border-border rounded-3xl p-5 shadow-xs gap-4"
            style={{ borderCurve: "continuous" }}
          >
            {!initialCustomerId && (
              <Pressable
                onPress={() => {
                  setCustomerId(null);
                  setCustomerSearch("");
                }}
                className="self-start active:opacity-70"
              >
                <Text className="text-primary text-xs font-extrabold uppercase tracking-wider">
                  Change customer
                </Text>
              </Pressable>
            )}

            {/* Type selector */}
            <View
              className="flex-row border border-border p-1 rounded-2xl"
              style={{ borderCurve: "continuous" }}
            >
              <Pressable
                onPress={() => setTxType("given")}
                className={cn(
                  "flex-1 py-2.5 rounded-xl items-center active:opacity-85",
                  txType === "given" ? "bg-danger" : "bg-transparent",
                )}
                style={{ borderCurve: "continuous" }}
              >
                <Text
                  className={cn(
                    "text-xs font-bold",
                    txType === "given"
                      ? "text-white"
                      : "text-foreground-secondary",
                  )}
                >
                  Given
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTxType("received")}
                className={cn(
                  "flex-1 py-2.5 rounded-xl items-center active:opacity-85",
                  txType === "received" ? "bg-success" : "bg-transparent",
                )}
                style={{ borderCurve: "continuous" }}
              >
                <Text
                  className={cn(
                    "text-xs font-bold",
                    txType === "received"
                      ? "text-white"
                      : "text-foreground-secondary",
                  )}
                >
                  Received
                </Text>
              </Pressable>
            </View>

            <FormField
              label="Amount (₹)"
              placeholder="0"
              keyboardType="number-pad"
              value={amountStr}
              onChangeText={(t) => setAmountStr(t.replace(/[^0-9]/g, ""))}
              autoFocus
            />

            <FormField
              label="Description (Optional)"
              placeholder="Bill no., notes..."
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </Animated.View>

        {/* Create bill option */}
        <Animated.View entering={FadeInDown.duration(300).delay(80)}>
          <Pressable
            onPress={handleCreateBill}
            className="bg-card border border-border rounded-3xl p-4 flex-row items-center gap-3.5 active:bg-border/30 shadow-xs"
            style={{ borderCurve: "continuous" }}
          >
            <View className="h-11 w-11 rounded-2xl bg-primary items-center justify-center">
              <Receipt size={18} color={WHITE} strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-sm">
                Create a Bill
              </Text>
              <Text className="text-muted text-xs font-semibold mt-0.5 leading-relaxed">
                Build an itemized invoice for {customer.name}, then log it as
                given.
              </Text>
            </View>
            <ChevronRight size={16} color={c.primary} />
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={cn(
            "py-4 rounded-2xl items-center active:opacity-85 shadow-sm disabled:opacity-50",
            txType === "given" ? "bg-danger" : "bg-success",
          )}
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-white font-extrabold text-sm tracking-wider uppercase">
            {saving ? "Saving..." : "Add Entry"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
