import { Text, TextInput, TextInputProps, View } from "react-native";

type FormFieldProps = TextInputProps & {
  label: string;
};

export function FormField({ label, className, ...props }: FormFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-foreground-secondary text-xs font-bold">
        {label}
      </Text>
      <TextInput
        placeholderTextColorClassName="accent-muted"
        className={`min-h-12 rounded-2xl border border-border bg-background px-4 py-3 text-base font-semibold text-foreground focus:border-primary ${className ?? ""}`}
        style={{ borderCurve: "continuous" }}
        {...props}
      />
    </View>
  );
}
