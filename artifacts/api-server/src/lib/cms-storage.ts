import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";

const sidecar = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function bucketName(): string {
  const value = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!value) throw new Error("Object storage is not configured");
  return value;
}

export async function createCmsUploadUrl(
  contentType: keyof typeof extensions,
): Promise<{ uploadUrl: string; objectPath: string }> {
  const objectPath = `public/${randomUUID()}.${extensions[contentType]}`;
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName(),
      object_name: objectPath,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Object storage signing failed: ${response.status}`);
  const { signed_url: uploadUrl } = (await response.json()) as {
    signed_url: string;
  };
  return { uploadUrl, objectPath: `/api/storage/objects/${objectPath}` };
}

export async function getCmsAsset(objectPath: string) {
  if (
    !objectPath.startsWith("public/") ||
    objectPath.includes("..") ||
    objectPath.includes("\\")
  ) {
    return null;
  }
  const file = storage.bucket(bucketName()).file(objectPath);
  const [exists] = await file.exists();
  return exists ? file : null;
}