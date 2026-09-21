import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preparePhotoForPrint, profilePhoto } from "../src/profilePhoto.ts";

test("portrait is a local JPEG with explicit dimensions and no EXIF metadata", () => {
  const photo = readFileSync(new URL(`../public/${profilePhoto.src}`, import.meta.url));
  assert.equal(photo.readUInt16BE(0), 0xffd8);
  assert.equal(profilePhoto.width, 1165);
  assert.equal(profilePhoto.height, 1345);
  assert.ok(profilePhoto.alt.includes("Ruihong Xie"));
  assert.ok(!photo.includes(Buffer.from("Exif\0\0")));
});

test("print preparation waits for image decoding", async () => {
  let decodeFinished = false;
  await preparePhotoForPrint({ complete: true, naturalWidth: 1165, async decode() { await Promise.resolve(); decodeFinished = true; } });
  assert.equal(decodeFinished, true);
});

test("print preparation rejects missing or broken images instead of silently omitting the photo", async () => {
  await assert.rejects(preparePhotoForPrint(null), /unavailable/);
  await assert.rejects(preparePhotoForPrint({ complete: true, naturalWidth: 0, async decode() {} }), /not loaded/);
  await assert.rejects(preparePhotoForPrint({ complete: false, naturalWidth: 0, async decode() { throw new Error("Decode failed"); } }), /Decode failed/);
});
