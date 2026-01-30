// Image Compression Utility - Creates compressed thumbnails for local storage
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Create a compressed thumbnail from an image URI
 * @param {string} uri - Source image URI
 * @param {number} size - Target size (width & height), default 100px
 * @param {number} quality - Compression quality 0-1, default 0.5
 * @returns {Promise<string>} Base64 data URI (data:image/jpeg;base64,...)
 */
export const createThumbnail = async (uri, size = 100, quality = 0.5) => {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: size, height: size } }],
            {
                compress: quality,
                format: ImageManipulator.SaveFormat.JPEG,
                base64: true
            }
        );

        if (!result.base64) {
            console.warn('📷 [COMPRESS] No base64 in result');
            return null;
        }

        console.log(`📷 [COMPRESS] Created ${size}x${size} thumbnail, ~${Math.round(result.base64.length / 1024)}KB`);
        return `data:image/jpeg;base64,${result.base64}`;
    } catch (error) {
        console.error('📷 [COMPRESS] Failed to create thumbnail:', error.message);
        return null;
    }
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
