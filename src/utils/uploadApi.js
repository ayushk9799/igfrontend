import { API_BASE } from '../constants/Api';

/**
 * Upload an image to S3 using presigned URL
 * 
 * @param {string} localUri - Local file:// URI of the image
 * @param {string} folder - S3 folder name (e.g., 'daily-photos', 'profile-pics')
 * @returns {Promise<string>} - The public S3 URL of the uploaded image
 */
export const uploadImageToS3 = async (localUri, folder = 'uploads') => {

    try {
        // Step 1: Get presigned URL from backend
        const fileName = `photo_${Date.now()}.jpg`;
        const fileType = 'image/jpeg';

        const presignedResponse = await fetch(`${API_BASE}/api/upload/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, fileType, folder }),
        });

        const presignedData = await presignedResponse.json();

        if (!presignedData.success) {
            throw new Error(presignedData.message || 'Failed to get presigned URL');
        }

        const { presignedUrl, publicUrl } = presignedData.data;

        // Step 2: Read the file and upload to S3
        const fileResponse = await fetch(localUri);
        const blob = await fileResponse.blob();

        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': fileType,
            },
        });

        if (!uploadResponse.ok) {
            throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
        }

        return publicUrl;
    } catch (error) {
        console.error('📤 [S3_UPLOAD] ❌ Error:', error);
        throw error;
    }
};

/**
 * Upload an audio file to S3 using presigned URL
 * 
 * @param {string} localUri - Local file:// URI of the audio file
 * @param {string} folder - S3 folder name (e.g., 'voice-recordings')
 * @returns {Promise<string>} - The public S3 URL of the uploaded audio
 */
export const uploadAudioToS3 = async (localUri, folder = 'voice-recordings') => {

    try {
        // Step 1: Get presigned URL from backend
        const fileName = `voice_${Date.now()}.m4a`;
        const fileType = 'audio/m4a';

        const presignedResponse = await fetch(`${API_BASE}/api/upload/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, fileType, folder }),
        });

        const presignedData = await presignedResponse.json();

        if (!presignedData.success) {
            throw new Error(presignedData.message || 'Failed to get presigned URL');
        }

        const { presignedUrl, publicUrl } = presignedData.data;

        // Step 2: Read the file and upload to S3
        const blob = await fileResponse.blob();

        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': fileType,
            },
        });

        if (!uploadResponse.ok) {
            throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
        }

        return publicUrl;
    } catch (error) {
        console.error('📤 [S3_AUDIO_UPLOAD] ❌ Error:', error);
        throw error;
    }
};
