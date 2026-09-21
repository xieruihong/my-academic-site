// Shared by the profile and printable CV. The supplied image is kept uncropped.
export const profilePhoto = {
  src: "./ruihong-xie-portrait.jpg",
  alt: "Portrait of Ruihong Xie",
  width: 1165,
  height: 1345,
} as const;

export async function preparePhotoForPrint(photo: Pick<HTMLImageElement, "decode" | "complete" | "naturalWidth"> | null) {
  if (!photo) throw new Error("Portrait is unavailable");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      photo.decode(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Portrait loading timed out")), 10000); }),
    ]);
    if (!photo.complete || photo.naturalWidth === 0) throw new Error("Portrait has not loaded");
  } finally {
    clearTimeout(timer);
  }
}
