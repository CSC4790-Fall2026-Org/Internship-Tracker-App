// Text and TextInput in Geist, the website's typeface. Each weight is its own font file, so the weight a style asks
// for (fontWeight: "600") is turned into the matching family here; styles elsewhere keep using fontWeight as normal.
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from "react-native";

/** The weights the app loads (see the root layout). Anything else falls to the nearest one. */
export const GEIST = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
} as const;

export function geistFamily(weight: TextStyle["fontWeight"]): string {
  const w = weight === "bold" ? 700 : weight === "normal" || weight === undefined ? 400 : Number(weight);
  if (w >= 700) return GEIST.bold;
  if (w >= 600) return GEIST.semibold;
  if (w >= 500) return GEIST.medium;
  return GEIST.regular;
}

/** The style with Geist applied for its weight. An explicit fontFamily (like a monospace one) is left alone. */
function withGeist(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return flat;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: geistFamily(fontWeight) };
}

export function Text({ style, ...rest }: TextProps) {
  return <RNText style={withGeist(style)} {...rest} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  return <RNTextInput style={withGeist(style)} {...rest} />;
}
