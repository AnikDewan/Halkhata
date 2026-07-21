import { useAppAlert } from "@/components/app-alert";
import { AppHeader } from "@/components/app-header";
import { db } from "@/db/db";
import { customers, transactions } from "@/db/schema";
import {
  ensureDailyBackup,
  exportJsonBackupFile,
  formatBackupCounts,
  formatBackupLabel,
  getBackupStatus,
  importAndResetBackups,
  linkDurableBackupFolder,
  peekImportFile,
  prepareForClearAll,
  restoreBackupById,
  unlinkDurableBackupFolder,
  type BackupEntry,
  type BackupStatus,
} from "@/lib/backup";
import { cn } from "@/lib/cn";
import { useThemeColors, WHITE } from "@/lib/theme";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  Download,
  FolderOpen,
  HardDrive,
  Moon,
  Receipt,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Uniwind, useUniwind } from "uniwind";

type ThemeChoice = "system" | "light" | "dark";

export default function SettingsScreen() {
  const router = useRouter();
  const { alert } = useAppAlert();
  const { theme, hasAdaptiveThemes } = useUniwind();
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const activeTheme: ThemeChoice = hasAdaptiveThemes
    ? "system"
    : (theme as ThemeChoice);

  const refreshBackupStatus = useCallback(async () => {
    try {
      setBackupStatus(await getBackupStatus());
    } catch {
      setBackupStatus(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshBackupStatus();
    }, [refreshBackupStatus]),
  );

  const handleLinkBackupFolder = () => {
    alert(
      "Set Up Auto Backup",
      "Choose a folder on your phone (Documents or Downloads). Backups are saved there every day and stay even if you uninstall the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Choose Folder",
          onPress: async () => {
            setBusy(true);
            try {
              const result = await linkDurableBackupFolder();
              await ensureDailyBackup();
              await refreshBackupStatus();
              alert(
                "Backup Ready",
                result.recoveredCount > 0
                  ? `Found ${result.recoveredCount} existing backup${result.recoveredCount === 1 ? "" : "s"}. You can restore below.`
                  : "Daily backups will be saved to this folder.",
              );
            } catch (e: any) {
              if (
                e?.message &&
                !/cancel|dismiss|user/i.test(String(e.message))
              ) {
                alert("Setup Failed", e?.message ?? "Could not open folder.");
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleUnlinkBackupFolder = () => {
    alert(
      "Turn Off Auto Backup?",
      "Daily backups will stop. Files already in the folder are not deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn Off",
          style: "destructive",
          onPress: async () => {
            unlinkDurableBackupFolder();
            await refreshBackupStatus();
          },
        },
      ],
    );
  };

  const handleExportData = async () => {
    setBusy(true);
    try {
      const result = await exportJsonBackupFile();
      alert(
        "Export Ready",
        `Shared ${result.fileName} with ${result.customerCount} customers.`,
      );
    } catch (e: any) {
      if (e?.message === "EMPTY") {
        alert("No Data", "There is nothing to export yet.");
      } else {
        alert("Export Failed", e?.message ?? "Could not export.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImportData = async () => {
    setBusy(true);
    try {
      const peeked = await peekImportFile();
      if (!peeked) {
        setBusy(false);
        return;
      }

      alert(
        "Import Backup?",
        `Replace all current data with ${peeked.customerCount} customers and ${peeked.transactionCount} entries from ${peeked.fileName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            style: "destructive",
            onPress: async () => {
              setBusy(true);
              try {
                const counts = await importAndResetBackups(peeked.raw);
                await refreshBackupStatus();
                alert(
                  "Import Complete",
                  `Loaded ${counts.customerCount} customers and ${counts.transactionCount} entries.`,
                );
              } catch (err: any) {
                alert("Import Failed", err?.message ?? "Could not import.");
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (e: any) {
      alert("Import Failed", e?.message ?? "Could not read the file.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreAutoBackup = (entry: BackupEntry) => {
    alert(
      "Restore Backup?",
      `Replace all current data with:\n${formatBackupLabel(entry)}\n${formatBackupCounts(entry)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const counts = await restoreBackupById(entry.id);
              await refreshBackupStatus();
              alert(
                "Restored",
                `Loaded ${counts.customerCount} customers and ${counts.transactionCount} entries.`,
              );
            } catch (e: any) {
              alert("Restore Failed", e?.message ?? "Could not restore.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleClearAllData = () => {
    const linked = !!backupStatus?.durableLinked;
    alert(
      "Clear All Data",
      linked
        ? "Delete every customer and transaction? A copy of your data will be kept so you can restore for up to 7 days."
        : "Delete every customer and transaction? Set up auto backup first if you may need to restore.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            alert(
              "Are You Sure?",
              "This cannot be undone from the live ledger.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Everything",
                  style: "destructive",
                  onPress: async () => {
                    setBusy(true);
                    try {
                      const { preClearBackup } = await prepareForClearAll();
                      await db.transaction(async (tx) => {
                        await tx.delete(transactions);
                        await tx.delete(customers);
                      });
                      await refreshBackupStatus();
                      alert(
                        "Data Cleared",
                        preClearBackup
                          ? "Everything was deleted. You can restore the previous data from Backup below for up to 7 days."
                          : "Everything was deleted.",
                      );
                    } catch (e: any) {
                      alert("Error", e?.message ?? "Failed to clear data.");
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const themeChoices: { value: ThemeChoice; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Tools" subtitle="Bills, reminders, backup, theme" />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-28"
      >
        <Animated.View entering={FadeInDown.duration(400)} className="gap-6">
          <View>
            <Text className="text-primary text-xs font-bold uppercase tracking-widest mb-2 px-1">
              Ledger Tools
            </Text>
            <View
              className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs"
              style={{ borderCurve: "continuous" }}
            >
              <ToolRow
                icon={<Bell size={18} color={WHITE} strokeWidth={2.2} />}
                iconClassName="bg-danger"
                title="Reminders"
                subtitle="Message customers who owe money"
                onPress={() => router.push("/reminders")}
              />
              <ToolRow
                icon={<Receipt size={18} color={WHITE} strokeWidth={2.2} />}
                iconClassName="bg-primary"
                title="Generate Bill"
                subtitle="Create an invoice and log credit"
                onPress={() => router.push("/billing")}
                last
              />
            </View>
          </View>

          <View>
            <Text className="text-primary text-xs font-bold uppercase tracking-widest mb-2 px-1">
              Appearance
            </Text>
            <View
              className="bg-card border border-border rounded-3xl p-4 shadow-xs"
              style={{ borderCurve: "continuous" }}
            >
              <View className="flex-row items-center gap-3 mb-4">
                <View className="h-9 w-9 rounded-xl bg-primary items-center justify-center">
                  {activeTheme === "dark" ? (
                    <Moon size={18} color={WHITE} />
                  ) : (
                    <Sun size={18} color={WHITE} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-bold text-sm">
                    Theme
                  </Text>
                  <Text className="text-muted text-xs mt-0.5 font-semibold">
                    Light, dark, or follow the phone
                  </Text>
                </View>
              </View>
              <View className="flex-row bg-background border border-border rounded-2xl p-1">
                {themeChoices.map((choice) => (
                  <Pressable
                    key={choice.value}
                    onPress={() => Uniwind.setTheme(choice.value)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl items-center",
                      activeTheme === choice.value
                        ? "bg-primary"
                        : "bg-transparent",
                    )}
                    style={{ borderCurve: "continuous" }}
                  >
                    <Text
                      className={cn(
                        "text-xs font-extrabold",
                        activeTheme === choice.value
                          ? "text-white"
                          : "text-foreground-secondary",
                      )}
                    >
                      {choice.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View>
            <Text className="text-primary text-xs font-bold uppercase tracking-widest mb-2 px-1">
              Backup
            </Text>

            <AutoBackupCard
              status={backupStatus}
              busy={busy}
              onRestore={handleRestoreAutoBackup}
              onLinkFolder={handleLinkBackupFolder}
              onUnlinkFolder={handleUnlinkBackupFolder}
            />

            <View
              className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs mt-3"
              style={{ borderCurve: "continuous" }}
            >
              <ToolRow
                icon={<Upload size={18} color={WHITE} strokeWidth={2.2} />}
                iconClassName="bg-primary"
                title="Export Backup"
                subtitle="Share a copy of your ledger"
                onPress={handleExportData}
                disabled={busy}
              />
              <ToolRow
                icon={<Download size={18} color={WHITE} strokeWidth={2.2} />}
                iconClassName="bg-primary"
                title="Import Backup"
                subtitle="Restore from a saved file"
                onPress={handleImportData}
                disabled={busy}
              />
              <ToolRow
                icon={<Trash2 size={18} color={WHITE} strokeWidth={2.2} />}
                iconClassName="bg-danger"
                title="Clear All Data"
                subtitle="Delete every customer and entry"
                onPress={handleClearAllData}
                danger
                last
                disabled={busy}
              />
            </View>
          </View>

          <View className="items-center pb-4 gap-1">
            <Text className="text-primary font-bold text-sm">HalKhata</Text>
            <Text className="text-muted text-xs font-medium">
              Version 1.0.0
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {busy && (
        <View className="absolute inset-0 items-center justify-center bg-black/25">
          <View
            className="bg-card px-6 py-5 rounded-3xl border border-border items-center gap-3 shadow-xl"
            style={{ borderCurve: "continuous" }}
          >
            <ActivityIndicator size="large" colorClassName="accent-primary" />
            <Text className="text-foreground font-bold text-sm">Working…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function AutoBackupCard({
  status,
  busy,
  onRestore,
  onLinkFolder,
  onUnlinkFolder,
}: {
  status: BackupStatus | null;
  busy: boolean;
  onRestore: (entry: BackupEntry) => void;
  onLinkFolder: () => void;
  onUnlinkFolder: () => void;
}) {
  const colors = useThemeColors();
  const linked = !!status?.durableLinked;
  const last = status?.lastBackup ?? null;
  const backups = status?.backups ?? [];

  return (
    <View
      className="bg-card border border-border rounded-3xl p-4 shadow-xs"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-center gap-3.5">
        <View className="h-10 w-10 rounded-xl items-center justify-center bg-primary">
          {linked ? (
            <HardDrive size={18} color={WHITE} strokeWidth={2.2} />
          ) : (
            <FolderOpen size={18} color={WHITE} strokeWidth={2.2} />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-bold text-sm">
            Daily Auto Backup
          </Text>
          <Text className="text-muted text-xs mt-0.5 font-semibold">
            {linked
              ? last
                ? formatBackupLabel(last)
                : "On · waiting for first backup"
              : "Off · choose a folder to turn on"}
          </Text>
        </View>
      </View>

      <Pressable
        disabled={busy}
        onPress={onLinkFolder}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 active:opacity-85"
        style={{ borderCurve: "continuous" }}
      >
        <FolderOpen size={16} color={WHITE} strokeWidth={2.2} />
        <Text className="text-white font-extrabold text-xs uppercase">
          {linked ? "Change Folder" : "Turn On Auto Backup"}
        </Text>
      </Pressable>

      {linked && (
        <Pressable
          disabled={busy}
          onPress={onUnlinkFolder}
          className="mt-2 py-2 items-center active:opacity-70"
        >
          <Text className="text-muted text-xs font-bold">Turn off</Text>
        </Pressable>
      )}

      {backups.length > 0 && (
        <View className="mt-4 gap-2">
          <Text className="text-muted text-[11px] font-extrabold uppercase tracking-wider px-0.5">
            Restore
          </Text>
          {backups.map((entry) => (
            <Pressable
              key={entry.id}
              disabled={busy}
              onPress={() => onRestore(entry)}
              className="flex-row items-center gap-3 rounded-2xl border border-border bg-background px-3.5 py-3 active:bg-border/40"
              style={{ borderCurve: "continuous" }}
            >
              <View className="h-9 w-9 rounded-xl bg-primary/10 items-center justify-center">
                <RotateCcw size={16} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-bold text-xs">
                  {formatBackupLabel(entry)}
                </Text>
                <Text className="text-muted text-[11px] font-semibold mt-0.5">
                  {formatBackupCounts(entry)}
                </Text>
              </View>
              <ChevronRight size={14} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ToolRow({
  icon,
  iconClassName,
  title,
  subtitle,
  onPress,
  danger,
  last,
  disabled,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row items-center justify-between p-4 active:bg-border",
        last ? "" : "border-b border-border",
        disabled && "opacity-50",
      )}
    >
      <View className="flex-row items-center gap-3.5 flex-1 pr-3">
        <View
          className={cn(
            "h-9 w-9 rounded-xl items-center justify-center",
            iconClassName,
          )}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text
            className={cn(
              "font-bold text-sm",
              danger ? "text-danger" : "text-foreground",
            )}
          >
            {title}
          </Text>
          <Text
            className="text-muted text-xs mt-0.5 font-semibold"
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={c.primary} />
    </Pressable>
  );
}
