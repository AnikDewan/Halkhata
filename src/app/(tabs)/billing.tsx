import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { FormField } from "@/components/form-field";
import { SearchField } from "@/components/search-field";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import { cn } from "@/lib/cn";
import { formatMoney, parseRupees } from "@/lib/format";
import { shareInvoicePdf } from "@/lib/pdf";
import { matchesSearch } from "@/lib/search";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight, Receipt, Share2, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

interface InvoiceItem {
  id: string;
  name: string;
  rate: number; // Whole rupees
  quantity: number;
}

export default function BillingScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const preselectedCustomerId = params.customerId
    ? Number(params.customerId)
    : null;

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemRateStr, setItemRateStr] = useState("");
  const [itemQtyStr, setItemQtyStr] = useState("1");
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const customersQuery = db.select().from(customers).orderBy(customers.name);
  const { data: customerList = [] } = useLiveQuery(customersQuery);

  const preselectedQuery =
    preselectedCustomerId != null && Number.isFinite(preselectedCustomerId)
      ? db
          .select()
          .from(customers)
          .where(eq(customers.id, preselectedCustomerId))
          .limit(1)
      : db.select().from(customers).limit(0);
  const { data: preselectedRows = [] } = useLiveQuery(preselectedQuery);
  const preselectedCustomer = preselectedRows[0];

  const filteredCustomers = customerList.filter((row) =>
    matchesSearch(searchQuery, [row.name, row.phone]),
  );

  const handleAddItem = () => {
    if (!itemName.trim()) {
      alert("Input Error", "Please enter an item name.");
      return;
    }
    const rateVal = parseRupees(itemRateStr);
    if (rateVal == null) {
      alert("Input Error", "Please enter a valid rate in whole rupees.");
      return;
    }
    const qtyVal = parseInt(itemQtyStr, 10);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      alert("Input Error", "Please enter a valid quantity.");
      return;
    }

    const newItem: InvoiceItem = {
      id: Math.random().toString(36).substring(7),
      name: itemName.trim(),
      rate: rateVal,
      quantity: qtyVal,
    };

    setItems([...items, newItem]);
    setItemName("");
    setItemRateStr("");
    setItemQtyStr("1");
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const totalAmount = items.reduce(
    (acc, item) => acc + item.rate * item.quantity,
    0,
  );

  const handleExportInvoice = async () => {
    if (items.length === 0) {
      alert("No Items", "Add at least one item to generate a bill.");
      return;
    }
    try {
      await shareInvoicePdf({
        customerName: preselectedCustomer?.name,
        customerPhone: preselectedCustomer?.phone,
        items,
        totalAmount,
      });
    } catch (e: any) {
      alert("Error", "Could not generate invoice PDF: " + e.message);
    }
  };

  const handleSaveToLedger = async (
    customerId: number,
    customerName: string,
  ) => {
    if (items.length === 0) {
      alert("No Items", "Add at least one item to log a bill.");
      return;
    }

    const itemsDescription = items
      .map((i) => `${i.name} x ${i.quantity}`)
      .join(", ");
    const finalDescription = `Invoice: ${itemsDescription}`.substring(0, 100);

    try {
      await db.insert(transactions).values({
        customerId,
        type: "given",
        amount: totalAmount,
        description: finalDescription,
      });

      alert(
        "Ledger Updated",
        `Logged ${formatMoney(totalAmount)} under ${customerName}'s account.`,
        [
          {
            text: "Go to Customer",
            onPress: () => {
              setCustomerModalVisible(false);
              setItems([]);
              router.replace(`/customer/${customerId}` as any);
            },
          },
          {
            text: "Keep Billing",
            style: "cancel",
            onPress: () => {
              setCustomerModalVisible(false);
              setItems([]);
            },
          },
        ],
      );
    } catch (e: any) {
      alert("Error", "Failed to update ledger: " + e.message);
    }
  };

  const handleLogGiven = () => {
    if (items.length === 0) {
      alert("No Items", "Add at least one item to log a bill.");
      return;
    }

    if (preselectedCustomer) {
      handleSaveToLedger(preselectedCustomer.id, preselectedCustomer.name);
      return;
    }

    setCustomerModalVisible(true);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Generate Bill"
        subtitle={
          preselectedCustomer
            ? `For ${preselectedCustomer.name}`
            : "Itemized bill"
        }
        back
      />

      <View className="flex-1 px-4 pt-4">
        <View
          className="bg-card border border-border rounded-3xl p-5 mb-5 shadow-xs"
          style={{ borderCurve: "continuous" }}
        >
          <Text className="text-foreground-secondary text-xs font-bold uppercase tracking-wider mb-3">
            Add Line Item
          </Text>

          <View className="gap-4">
            <FormField
              label="Item Name"
              placeholder="e.g. Rice, Soap, Service fee"
              value={itemName}
              onChangeText={setItemName}
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormField
                  label="Rate (₹)"
                  placeholder="0"
                  keyboardType="number-pad"
                  value={itemRateStr}
                  onChangeText={(t) => setItemRateStr(t.replace(/[^0-9]/g, ""))}
                />
              </View>

              <View className="flex-1">
                <FormField
                  label="Quantity"
                  placeholder="1"
                  keyboardType="number-pad"
                  value={itemQtyStr}
                  onChangeText={(t) => setItemQtyStr(t.replace(/[^0-9]/g, ""))}
                />
              </View>
            </View>

            <Pressable
              onPress={handleAddItem}
              className="bg-primary active:opacity-90 py-3 rounded-2xl items-center justify-center mt-1.5 shadow-sm"
              style={{ borderCurve: "continuous" }}
            >
              <Text className="text-white font-extrabold text-xs tracking-wider uppercase">
                Add to Bill
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-foreground text-sm font-bold">Bill Items</Text>
          <Text className="text-muted text-xxs font-semibold">
            Total: {items.length} items
          </Text>
        </View>

        {items.length === 0 ? (
          <View
            className="flex-1 items-center justify-center bg-background p-8 mb-24"
            style={{ borderCurve: "continuous" }}
          >
            <View className="h-12 w-12 rounded-full bg-primary items-center justify-center mb-3">
              <Receipt size={20} color={WHITE} />
            </View>
            <Text className="text-foreground font-bold text-sm">
              Invoice is empty
            </Text>
            <Text className="text-muted text-xs text-center mt-1">
              Add items using the form above to build the invoice.
            </Text>
          </View>
        ) : (
          <View className="flex-1 mb-24" style={{ minHeight: 150 }}>
            <FlashList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Animated.View
                  entering={FadeInDown.duration(300)}
                  exiting={FadeOut.duration(200)}
                  layout={LinearTransition.springify()}
                >
                  <View
                    className="flex-row justify-between items-center bg-card border border-border p-3.5 rounded-2xl mb-2 shadow-xs"
                    style={{ borderCurve: "continuous" }}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-foreground font-bold text-xs">
                        {item.name}
                      </Text>
                      <Text className="text-muted text-xxs font-semibold mt-1">
                        {item.quantity} x {formatMoney(item.rate)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3.5">
                      <Text className="text-foreground font-extrabold text-xs tabular-nums">
                        {formatMoney(item.rate * item.quantity).replace(
                          /[^\d.,]/g,
                          "",
                        )}
                      </Text>
                      <Pressable
                        onPress={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg active:bg-danger"
                      >
                        <Trash2 size={13} color={c.danger} />
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              )}
            />
          </View>
        )}

        <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border px-5 py-4 flex-row justify-between items-center shadow-lg">
          <View>
            <Text className="text-foreground-secondary text-xxs font-bold uppercase tracking-wider">
              Total Amount
            </Text>
            <Text className="text-foreground text-2xl font-black mt-0.5 tabular-nums">
              {formatMoney(totalAmount)}
            </Text>
          </View>

          <View className="flex-row gap-2.5">
            <Pressable
              disabled={items.length === 0}
              onPress={handleExportInvoice}
              className={cn(
                "h-11 px-4 rounded-xl border border-border items-center justify-center active:bg-border flex-row gap-1.5",
                items.length === 0 ? "opacity-45" : "bg-card",
              )}
              style={{ borderCurve: "continuous" }}
            >
              <Share2 size={13} color={c.primary} />
              <Text className="text-foreground font-extrabold text-xs tracking-wider uppercase">
                Share
              </Text>
            </Pressable>
            <Pressable
              disabled={items.length === 0}
              onPress={handleLogGiven}
              className={cn(
                "h-11 px-5 rounded-xl items-center justify-center active:opacity-85 shadow-xs",
                items.length === 0 ? "bg-primary/45 opacity-55" : "bg-primary",
              )}
              style={{ borderCurve: "continuous" }}
            >
              <Text className="text-white font-extrabold text-xs tracking-wider uppercase">
                Log Given
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={customerModalVisible}
        animationType="slide"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View className="flex-1 bg-background">
          <AppHeader
            title="Select Customer"
            subtitle="Add bill to ledger"
            right={
              <Pressable
                onPress={() => setCustomerModalVisible(false)}
                className="p-2 bg-card border border-border rounded-full shadow-xs"
              >
                <X size={18} color={c.primary} />
              </Pressable>
            }
          />

          <View className="px-4 py-4">
            <Text className="text-foreground font-bold text-sm">
              Add Bill to Ledger
            </Text>
            <Text className="text-muted text-xs mt-1 font-semibold leading-relaxed">
              Select which customer will be charged the total bill amount of{" "}
              {formatMoney(totalAmount)} as a given entry.
            </Text>
          </View>

          <View className="px-4 mb-4">
            <SearchField
              placeholder="Search customer by name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredCustomers.length === 0 ? (
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-muted text-xs text-center font-semibold">
                {customerList.length === 0
                  ? "You must add a customer in the Customers tab before adding a ledger entry."
                  : "No matching customers found."}
              </Text>
            </View>
          ) : (
            <View className="flex-1 px-4 mb-4" style={{ minHeight: 200 }}>
              <FlashList
                data={filteredCustomers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item, index }) => (
                  <Animated.View
                    entering={FadeInDown.duration(300).delay(index * 15)}
                    layout={LinearTransition.springify()}
                  >
                    <Pressable
                      onPress={() => handleSaveToLedger(item.id, item.name)}
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
                  </Animated.View>
                )}
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
