import { API_BASE } from '../constants/Api';

/**
 * Upload an image to S3 using presigned URL
 * 
 * @param {string} localUri - Local file:// URI of the image
 * @param {string} folder - S3 folder name (e.g., 'daily-photos', 'profile-pics')
 * @returns {Promise<string>} - The public S3 URL of the uploaded image
 */
export const uploadImageToS3 = async (localUri, folder = 'uploads') => {
    console.log('📤 [S3_UPLOAD] Starting upload...');
    console.log('📤 [S3_UPLOAD] Local URI:', localUri);
    console.log('📤 [S3_UPLOAD] Folder:', folder);

    try {
        // Step 1: Get presigned URL from backend
        const fileName = `photo_${Date.now()}.jpg`;
        const fileType = 'image/jpeg';

        console.log('📤 [S3_UPLOAD] Requesting presigned URL...');
        const presignedResponse = await fetch(`${API_BASE}/api/upload/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, fileType, folder }),
        });

        const presignedData = await presignedResponse.json();
        console.log('📤 [S3_UPLOAD] Presigned response:', presignedData);

        if (!presignedData.success) {
            throw new Error(presignedData.message || 'Failed to get presigned URL');
        }

        const { presignedUrl, publicUrl } = presignedData.data;

        // Step 2: Read the file and upload to S3
        console.log('📤 [S3_UPLOAD] Fetching local file...');
        const fileResponse = await fetch(localUri);
        const blob = await fileResponse.blob();
        console.log('📤 [S3_UPLOAD] File blob size:', blob.size);

        console.log('📤 [S3_UPLOAD] Uploading to S3...');
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

        console.log('📤 [S3_UPLOAD] ✅ Upload successful!');
        console.log('📤 [S3_UPLOAD] Public URL:', publicUrl);

        return publicUrl;
    } catch (error) {
        console.error('📤 [S3_UPLOAD] ❌ Error:', error);
        throw error;
    }
};
