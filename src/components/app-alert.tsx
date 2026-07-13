import { cn } from "@/lib/cn";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";

export type AppAlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
};

type AlertContextValue = {
  alert: (title: string, message?: string, buttons?: AppAlertButton[]) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function useAppAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }
  return ctx;
}

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const visible = config !== null;

  const alert = (
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
  ) => {
    setConfig({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "OK", style: "default" }],
    });
  };

  const close = () => setConfig(null);

  const handlePress = (button: AppAlertButton) => {
    close();
    // Defer so the modal can dismiss before navigation / follow-up alerts
    requestAnimationFrame(() => {
      button.onPress?.();
    });
  };

  const buttons = config?.buttons ?? [
    { text: "OK", style: "default" as const },
  ];
  const isStacked = buttons.length > 2;

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-8">
          {config && (
            <Animated.View
              entering={ZoomIn.duration(220)}
              exiting={ZoomOut.duration(160)}
              className="bg-card w-full max-w-sm rounded-3xl border border-border overflow-hidden shadow-xl"
              style={{ borderCurve: "continuous" }}
            >
              <View className="px-5 pt-5 pb-4">
                <Text className="text-foreground text-lg font-bold text-center">
                  {config.title}
                </Text>
                {!!config.message && (
                  <Text className="text-muted text-sm font-semibold text-center mt-2 leading-5">
                    {config.message}
                  </Text>
                )}
              </View>

              <View
                className={cn(
                  "border-t border-border",
                  isStacked ? "flex-col" : "flex-row",
                )}
              >
                {buttons.map((button, index) => {
                  const isLast = index === buttons.length - 1;
                  const isDestructive = button.style === "destructive";
                  const isCancel = button.style === "cancel";

                  return (
                    <Pressable
                      key={`${button.text}-${index}`}
                      onPress={() => handlePress(button)}
                      className={cn(
                        "items-center justify-center py-3.5 px-3 active:bg-border/40",
                        isStacked
                          ? "w-full border-b border-border last:border-b-0"
                          : "flex-1",
                        !isStacked && !isLast && "border-r border-border",
                      )}
                    >
                      <Text
                        className={cn(
                          "text-sm text-center",
                          isDestructive
                            ? "text-danger font-extrabold"
                            : isCancel
                              ? "text-muted font-bold"
                              : "text-primary font-extrabold",
                        )}
                      >
                        {button.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}
