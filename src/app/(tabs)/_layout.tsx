import { Tabs } from "expo-router";
import { Home, ReceiptText, Settings, Users } from "lucide-react-native";
import { useCSSVariable, useResolveClassNames } from "uniwind";

export default function TabsLayout() {
  const primaryColor = useCSSVariable("--color-primary") as string;
  const mutedColor = useCSSVariable("--color-muted") as string;

  const tabBarClassName = "bg-card py-5 h-18";
  const tabBarStyle = useResolveClassNames(tabBarClassName);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: primaryColor || "#ee161f",
        tabBarInactiveTintColor: mutedColor || "#9ca3af",
        tabBarStyle: tabBarStyle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          paddingBottom: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Home size={20} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color }) => (
            <Users size={20} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => (
            <ReceiptText size={20} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Tools",
          tabBarIcon: ({ color }) => (
            <Settings size={20} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
