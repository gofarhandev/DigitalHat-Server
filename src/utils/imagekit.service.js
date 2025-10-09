const ImageKit = require("imagekit");

// ✅ Initialize ImageKit instance
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

/**
 * ✅ Upload image buffer to ImageKit
 * @param {Object} file - Multer file object (with buffer, originalname, mimetype)
 * @returns {Promise<Object>} - Uploaded image data
 */
const uploadImage = async (file) => {
  if (!file || !file.buffer) {
    throw new Error("No valid file buffer found for upload");
  }

  try {
    const result = await imagekit.upload({
      file: file.buffer, // file buffer from multer memory storage
      fileName: file.originalname || `image_${Date.now()}`,
      folder: "/DigitalHat_Images", // ✅ optional folder name
      useUniqueFileName: true, // avoid overwriting existing files
      isPrivateFile: false, // public URL
      responseFields: "url,thumbnail,fileId,name", // only return useful fields
    });

    return {
      url: result.url,
      thumbnail: result.thumbnailUrl,
      id: result.fileId,
      name: result.name,
    };
  } catch (err) {
    console.error("❌ Image upload failed:", err.message);
    throw new Error("Image upload to ImageKit failed");
  }
};

module.exports = { uploadImage };
