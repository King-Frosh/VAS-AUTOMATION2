import { del, get, put } from "@vercel/blob";

function readWriteToken(): string {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("BLOB_READ_WRITE_TOKEN is not configured in the Vercel project environment.");
  return value;
}

/** Store data in a private Vercel Blob. The existing DB file_path column stores the pathname. */
export async function putPrivateBlob(pathname: string, data: Buffer, contentType: string): Promise<string> {
  const result = await put(pathname, data, {
    access: "private", addRandomSuffix: true, contentType, token: readWriteToken(),
  });
  return result.pathname;
}

/** Read private Blob bytes server-side. Authenticate/authorize before calling this helper. */
export async function readPrivateBlob(pathname: string): Promise<Buffer> {
  const result = await get(pathname, { access: "private", token: readWriteToken() });
  if (!result || result.statusCode !== 200) throw new Error("Private Blob object was not found.");
  // Read the Web ReadableStream with a reader instead of for-await-of.
  // This works with TypeScript DOM stream typings that do not expose
  // Symbol.asyncIterator on ReadableStream.
  const reader = result.stream.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function deletePrivateBlob(pathname: string): Promise<void> {
  if (pathname) await del(pathname, { token: readWriteToken() });
}
