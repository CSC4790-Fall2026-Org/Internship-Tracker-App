// Phone version of uploadAndParseResume in the website's src/data/resume.ts. That one takes a browser File;
// here the PDF comes from the document picker and is uploaded as bytes. Everything else is shared, and the
// path and checks match the website so the parse-resume Edge Function treats both the same.
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase";
import { fetchOrCreateProfile, functionErrorMessage, toProfile, type ResumeProfile, type UploadStage } from "@shared/data/resume";

const MAX_BYTES = 5 * 1024 * 1024;

/** Opens the Files picker for a PDF. Resolves to null if the person cancels. */
export async function pickResume(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
  return result.canceled ? null : result.assets[0];
}

/** Uploads the PDF to the user's own folder, then has the Edge Function parse it. */
export async function uploadAndParseResume(userId: string, asset: DocumentPicker.DocumentPickerAsset, onStage?: (stage: UploadStage) => void): Promise<ResumeProfile> {
  const isPdf = asset.mimeType === "application/pdf" || asset.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Please choose a PDF file.");
  if ((asset.size ?? 0) > MAX_BYTES) throw new Error("That file is larger than 5 MB.");

  onStage?.("uploading");
  // The parser fills in the resume fields and leaves job type and fields alone, so make sure the row
  // holding the onboarding answers exists first.
  await fetchOrCreateProfile();
  const bytes = await new File(asset.uri).arrayBuffer();
  const path = `${userId}/${Date.now()}-${asset.name.replace(/[^\w.-]+/g, "_")}`;
  const upload = await supabase.storage.from("resumes").upload(path, bytes, { contentType: "application/pdf" });
  if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);

  onStage?.("analyzing");
  const { data, error } = await supabase.functions.invoke("parse-resume", { body: { path } });
  if (error) throw new Error(await functionErrorMessage(error));
  return toProfile(data.profile);
}
