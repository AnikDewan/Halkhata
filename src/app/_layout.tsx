import { AppAlertProvider } from "@/components/app-alert";
import { db } from "@/db/db";
import { ensureDailyBackup } from "@/lib/backup";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  SafeAreaListener,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { Uniwind } from "uniwind";
import migrations from "../../drizzle/migrations";
import "../../global.css";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (!success) return;
    // Fire-and-forget: never block app launch on backup I/O.
    void ensureDailyBackup().catch(() => {
      // Silent — Tools page still shows last known status.
    });
  }, [success]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-danger text-lg font-bold">
          Database Migration Error
        </Text>
        <Text className="text-foreground mt-2 text-center">
          {error.message}
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" colorClassName="accent-primary" />
        <Text className="text-foreground-secondary mt-4 font-semibold">
          Initializing database...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaListener
        onChange={({ insets }) => {
          Uniwind.updateInsets(insets);
        }}
      >
        <AppAlertProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="customer/[id]" />
            <Stack.Screen name="customer/add" />
            <Stack.Screen name="customer/import-contacts" />
            <Stack.Screen name="transaction/add" />
          </Stack>
        </AppAlertProvider>
      </SafeAreaListener>
    </SafeAreaProvider>
  );
}
