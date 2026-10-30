// Phone versions of the website's CSV download and file input. Building and reading the CSV is shared
// (src/data/csv.ts); only getting the file in and out of the phone differs.
import { Share } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import type { Application } from "@shared/data/types";
import { applicationsToCsv, exportFilename } from "@shared/data/csv";

/** Writes the CSV to a temporary file and opens the share sheet, where it can be saved to Files, mailed or AirDropped. */
export async function shareApplicationsCsv(apps: Application[]) {
  const file = new File(Paths.cache, exportFilename());
  file.create({ overwrite: true });
  file.write(applicationsToCsv(apps));
  await Share.share({ url: file.uri });
}

/** Opens the Files picker for a CSV. Resolves to its name and text, or null if the person cancels. */
export async function pickCsv(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "public.comma-separated-values-text"], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { name: asset.name, text: await new File(asset.uri).text() };
}
