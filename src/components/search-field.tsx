import { Search, XCircle } from "lucide-react-native";
import { Pressable, TextInput, View } from "react-native";
import { useThemeColors } from "@/lib/theme";

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
};

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: SearchFieldProps) {
  const c = useThemeColors();

  return (
    <View className="flex-row items-center bg-card border border-border px-3 rounded-2xl h-12 shadow-xs">
      <Search size={18} color={c.primary} className="mr-2" />
      <TextInput
        placeholder={placeholder}
        placeholderTextColorClassName="accent-muted"
        className="flex-1 text-foreground text-base font-semibold h-full"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} className="p-1">
          <XCircle size={16} color={c.primary} />
        </Pressable>
      )}
    </View>
  );
}
