import { useThemeColors } from "@/lib/theme";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
};

export function AppHeader({ title, subtitle, back, right }: AppHeaderProps) {
  const router = useRouter();
  const c = useThemeColors();

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <View className="pt-safe px-4 bg-background">
      <View className="min-h-16 flex-row items-center justify-around border-b border-border py-3">
        <View className="flex-row items-center flex-1 pr-3">
          {back && (
            <Pressable
              onPress={handleBack}
              className="h-10 w-10 rounded-full items-center justify-center bg-card border border-border mr-3 active:opacity-75"
            >
              <ArrowLeft size={18} color={c.primary} />
            </Pressable>
          )}
          <View className="flex-1">
            <Text
              className="text-primary text-2xl font-extrabold"
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                className="text-foreground-secondary text-xs font-semibold mt-0.5"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}
