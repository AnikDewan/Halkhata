import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { FormField } from "@/components/form-field";
import { db } from "@/db/db";
import { customers } from "@/db/schema";
import { WHITE } from "@/lib/theme";
import { useRouter } from "expo-router";
import { Contact } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export default function AddCustomerScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveManual = async () => {
    if (!name.trim()) {
      alert("Name required", "Please enter the customer's name.");
      return;
    }

    setSaving(true);
    try {
      await db.insert(customers).values({
        name: name.trim(),
        phone: phone.trim() || null,
      });
      router.back();
    } catch (e: any) {
      alert("Error", "Failed to save customer: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Add Customer" subtitle="Enter name and phone" back />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(350)} className="gap-5">
          <View
            className="bg-card border border-border rounded-3xl p-5 gap-4 shadow-xs"
            style={{ borderCurve: "continuous" }}
          >
            <FormField
              label="Customer Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
            />

            <FormField
              label="Phone Number (Optional)"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable
            onPress={handleSaveManual}
            disabled={saving}
            className="bg-primary py-4 rounded-2xl items-center active:opacity-85 shadow-sm disabled:opacity-50"
            style={{ borderCurve: "continuous" }}
          >
            <Text className="text-white font-extrabold text-sm tracking-wider uppercase">
              {saving ? "Saving..." : "Save Customer"}
            </Text>
          </Pressable>

          <View className="h-px bg-border my-2" />

          <Pressable
            onPress={() => router.push("/customer/import-contacts")}
            className="bg-primary py-4 rounded-2xl items-center active:opacity-85 shadow-sm"
            style={{ borderCurve: "continuous" }}
          >
            <View className="flex-row items-center gap-3">
              <Contact size={20} color={WHITE} strokeWidth={2.2} />
              <Text className="text-white font-bold text-base">
                From Contacts
              </Text>
            </View>
          </Pressable>
        </Animated.View>
        {/* )} */}
      </ScrollView>
    </View>
  );
}
