import { Plus } from "lucide-react-native";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

export type FabAction = {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
};

type ActionFabProps = {
  open?: boolean;
  onPress: () => void;
  actions?: FabAction[];
};

export function ActionFab({ open, onPress, actions = [] }: ActionFabProps) {
  return (
    <View className="absolute bottom-6 right-6 items-end">
      {open && actions.length > 0 && (
        <View className="mb-3 items-end gap-2.5">
          {actions.map((action, index) => (
            <Animated.View
              key={action.label}
              entering={FadeInDown.duration(180).delay(index * 40)}
              exiting={FadeOut.duration(140)}
            >
              <Pressable
                onPress={action.onPress}
                className="flex-row bg-card border border-border py-2.5 px-4 rounded-xl items-center gap-2 shadow-md active:bg-border/15"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-foreground text-xs font-extrabold">
                  {action.label}
                </Text>
                {action.icon}
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      <Pressable
        onPress={onPress}
        className="h-14 w-14 rounded-full bg-primary items-center justify-center shadow-lg active:scale-95 transition-transform"
      >
        <Animated.View
          style={{ transform: [{ rotate: open ? "45deg" : "0deg" }] }}
        >
          <Plus size={26} color="white" strokeWidth={2.5} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
