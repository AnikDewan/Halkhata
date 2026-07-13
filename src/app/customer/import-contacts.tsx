import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { SearchField } from "@/components/search-field";
import { db } from "@/db/db";
import { customers } from "@/db/schema";
import { matchesSearch } from "@/lib/search";
import { useThemeColors, WHITE } from "@/lib/theme";
import { FlashList } from "@shopify/flash-list";
import {
  Contact,
  ContactField,
  ContactsSortOrder,
  requestPermissionsAsync,
  type PartialContactDetails,
} from "expo-contacts";
import { useRouter } from "expo-router";
import { AlertCircle, UserCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
} from "react-native-reanimated";

const CONTACT_FIELDS = [ContactField.FULL_NAME, ContactField.PHONES] as const;

type PhoneContact = PartialContactDetails<typeof CONTACT_FIELDS>;

export default function ImportContactsScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
  const c = useThemeColors();
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await requestPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) {
            setLoading(false);
            alert(
              "Permission Denied",
              "Allow contacts access in Settings to import customers from your phone book.",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => router.back(),
                },
                { text: "OK", onPress: () => router.back() },
              ],
            );
          }
          return;
        }

        // New expo-contacts API: Contact.getAllDetails (legacy getContactsAsync is deprecated)
        const details = await Contact.getAllDetails(CONTACT_FIELDS, {
          sortOrder: ContactsSortOrder.GivenName,
        });

        const valid = details
          .filter(
            (item) =>
              !!item.fullName?.trim() &&
              Array.isArray(item.phones) &&
              item.phones.length > 0,
          )
          .sort((a, b) =>
            (a.fullName ?? "").localeCompare(b.fullName ?? "", undefined, {
              sensitivity: "base",
            }),
          );

        if (!cancelled) {
          setContacts(valid);
        }
      } catch (e: any) {
        if (!cancelled) {
          alert("Error", "Failed to load contacts: " + e.message, [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Load once on mount; alert/router are stable enough for this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = contacts.filter((item) =>
    matchesSearch(searchQuery, [
      item.fullName,
      ...(item.phones?.map((p) => p.number) ?? []),
    ]),
  );

  const handleSelect = async (contact: PhoneContact) => {
    const name = contact.fullName?.trim();
    if (!name) return;

    const rawPhone = contact.phones?.[0]?.number ?? "";
    const cleanedPhone = rawPhone.replace(/[^\d+]/g, "");

    setImportingId(contact.id);
    try {
      await db.insert(customers).values({
        name,
        phone: cleanedPhone || null,
      });
      router.back();
    } catch (e: any) {
      alert("Error", "Failed to save contact: " + e.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Import Contacts"
        subtitle="Search in বাংলা or English"
        back
        right={
          loading ? <ActivityIndicator colorClassName="accent-primary" /> : null
        }
      />

      <View className="px-4 pt-4 mb-3">
        <SearchField
          placeholder="Search phone contacts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator size="large" colorClassName="accent-primary" />
          <Text className="text-muted text-sm font-semibold mt-4">
            Loading contacts...
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <AlertCircle size={32} color={c.danger} />
          <Text className="text-foreground font-bold text-sm mt-3 text-center">
            No matching contacts
          </Text>
          <Text className="text-muted text-xs font-semibold mt-1.5 text-center max-w-60">
            {searchQuery
              ? "Try a different search term."
              : "No contacts with a name and phone number were found."}
          </Text>
        </View>
      ) : (
        <View className="flex-1 px-4 mb-4" style={{ minHeight: 200 }}>
          <FlashList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInDown.duration(280).delay(
                  Math.min(index, 12) * 15,
                )}
                layout={LinearTransition.springify()}
              >
                <Pressable
                  onPress={() => handleSelect(item)}
                  disabled={importingId === item.id}
                  className="flex-row justify-between items-center bg-card border border-border p-4 rounded-2xl mb-2 active:bg-border shadow-xs disabled:opacity-60"
                  style={{ borderCurve: "continuous" }}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-foreground font-bold text-sm">
                      {item.fullName}
                    </Text>
                    {item.phones?.[0]?.number && (
                      <Text className="text-muted text-xs font-semibold mt-1">
                        {item.phones[0].number}
                      </Text>
                    )}
                  </View>
                  <View className="h-8 w-8 rounded-full bg-primary items-center justify-center shadow-xs">
                    {importingId === item.id ? (
                      <ActivityIndicator size="small" color={WHITE} />
                    ) : (
                      <UserCheck size={14} color={WHITE} />
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            )}
          />
        </View>
      )}
    </View>
  );
}
