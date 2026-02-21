import { Text as DefaultText, View as DefaultView } from "react-native";
import { theme } from "@/constants/Colors";

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText["props"];
export type ViewProps = ThemeProps & DefaultView["props"];

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  return (
    <DefaultText style={[{ color: theme.text }, style]} {...otherProps} />
  );
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  return (
    <DefaultView style={[{ backgroundColor: theme.bg }, style]} {...otherProps} />
  );
}
