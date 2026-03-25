import { test, expect } from "@playwright/test";
import {
  MedusaApiClient,
  BACKEND_URL,
  PUBLISHABLE_KEY,
} from "../fixtures/api.fixture";
import { TEST_JPEG } from "../helpers/test-jpeg";

/**
 * S3 File Storage (Cloudflare R2) E2E Tests
 *
 * These tests verify that file uploads go to Cloudflare R2 (not in-memory)
 * and that uploaded files are publicly accessible. They require:
 * - Backend running with S3_BUCKET configured
 * - R2 bucket with public access enabled
 *
 * Tests upload via the review image upload endpoint (/store/reviews/uploads)
 * which uses Medusa's uploadFilesWorkflow under the hood.
 */

/** Upload a JPEG via the review uploads endpoint */
async function uploadTestImage(
  authToken: string,
  filename: string,
): Promise<{ url: string }[]> {
  const formData = new FormData();
  formData.append(
    "files",
    new Blob([TEST_JPEG], { type: "image/jpeg" }),
    filename,
  );

  const res = await fetch(`${BACKEND_URL}/store/reviews/uploads`, {
    method: "POST",
    headers: {
      "x-publishable-api-key": PUBLISHABLE_KEY,
      authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { files: { url: string }[] };
  return data.files;
}

test.describe("S3 File Storage (Cloudflare R2)", () => {
  test.skip(
    !PUBLISHABLE_KEY,
    "Skipping — NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY not set",
  );

  let authToken: string;

  test.beforeAll(async () => {
    const api = new MedusaApiClient();
    await api.registerCustomer({
      email: `e2e-s3-${Date.now()}@test.local`,
      password: "Test1234!",
      first_name: "S3",
      last_name: "Test",
    });
    authToken = api.getAuthToken();
  });

  test("upload returns a URL pointing to R2", async () => {
    const files = await uploadTestImage(authToken, "test-r2-url.jpg");

    expect(files).toHaveLength(1);
    expect(files[0]!.url).toContain("r2.dev");
  });

  test("uploaded file is publicly accessible", async () => {
    const files = await uploadTestImage(authToken, "test-r2-access.jpg");
    const fileUrl = files[0]!.url;

    const res = await fetch(fileUrl);

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("image/jpeg");
  });

  test("uploaded file content matches original", async () => {
    const files = await uploadTestImage(authToken, "test-r2-content.jpg");
    const fileUrl = files[0]!.url;

    const res = await fetch(fileUrl);
    const body = Buffer.from(await res.arrayBuffer());

    // JPEG starts with FF D8 FF
    expect(body[0]).toBe(0xff);
    expect(body[1]).toBe(0xd8);
    expect(body[2]).toBe(0xff);
    // File size should match our test JPEG
    expect(body.length).toBe(TEST_JPEG.length);
  });

  test("multiple files can be uploaded in one request", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new Blob([TEST_JPEG], { type: "image/jpeg" }),
      "multi-1.jpg",
    );
    formData.append(
      "files",
      new Blob([TEST_JPEG], { type: "image/jpeg" }),
      "multi-2.jpg",
    );

    const res = await fetch(`${BACKEND_URL}/store/reviews/uploads`, {
      method: "POST",
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { files: { url: string }[] };
    expect(data.files).toHaveLength(2);
    expect(data.files[0]!.url).toContain("r2.dev");
    expect(data.files[1]!.url).toContain("r2.dev");
    // Each file should have a unique URL
    expect(data.files[0]!.url).not.toBe(data.files[1]!.url);
  });
});
