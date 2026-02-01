// Image Compression Utility - Creates compressed thumbnails for local storage
// NOTE: This file is largely deprecated as we moved to native FileReader in useAvatarUpload.js
// but keeping it for now in case we need resizing logic later.

/**
 * [DEPRECATED] Create a compressed thumbnail from an image URI
 * This was using expo-image-manipulator but we are moving away from it.
 */
export const createThumbnail = async (uri, size = 100, quality = 0.5) => {
    console.warn('createThumbnail in imageCompression.js is deprecated. Use native conversion in hook instead.');
    return null;
};

/**
 * Create thumbnails for both user and partner avatars
 * @param {string} userAvatarUri - User's avatar URI (can be local or remote)
 * @param {string} partnerAvatarUri - Partner's avatar URI (can be local or remote)
 * @returns {Promise<{userThumbnail: string|null, partnerThumbnail: string|null}>}
 */
export const createAvatarThumbnails = async (userAvatarUri, partnerAvatarUri) => {
    const [userThumbnail, partnerThumbnail] = await Promise.all([
        userAvatarUri ? createThumbnail(userAvatarUri) : null,
        partnerAvatarUri ? createThumbnail(partnerAvatarUri) : null,
    ]);

    return { userThumbnail, partnerThumbnail };
};

export default { createThumbnail, createAvatarThumbnails };
