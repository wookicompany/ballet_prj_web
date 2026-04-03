import imageCompression from "browser-image-compression";

export const compressImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    return file;
  }
};
