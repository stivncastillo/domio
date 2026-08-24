import { View, type ViewProps } from "react-native";

export function Card({ className = "", ...props }: ViewProps & { className?: string }) {
  return <View className={`rounded-2xl bg-domio-card p-4 ${className}`} {...props} />;
}
