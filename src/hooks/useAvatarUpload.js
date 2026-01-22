// useAvatarUpload - Custom hook for managing avatar upload to S3
import { useState, useCallback } from 'react';
import { API_BASE } from '../constants/Api';
import { getUser, updateUser } from '../utils/authStorage';

/**
 * Custom hook for uploading user avatar to S3
 * Handles the full flow: get presigned URL -> upload to S3 -> update user profile
 */
export const useAvatarUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

  
    const uploadAvatar = useCallback(async (imageAsset) => {
        console.log('📸 [AVATAR] Starting upload...');
        console.log('📸 [AVATAR] Image asset:', JSON.stringify(imageAsset, null, 2));

        const user = getUser();
        console.log('📸 [AVATAR] User:', user?.id ? `ID: ${user.id}` : 'NOT AUTHENTICATED');

        if (!user?.id) {
            return { success: false, error: 'User not authenticated' };
        }

        setIsUploading(true);
        setError(null);

        try {
            // Extract file info from image asset
            const uri = imageAsset.uri;
            const fileName = imageAsset.fileName || `avatar_${Date.now()}.jpg`;
            const fileType = imageAsset.mimeType || 'image/jpeg';

            console.log('📸 [AVATAR] File info:', { uri, fileName, fileType });

            // Step 1: Get presigned URL from backend
            console.log('📸 [AVATAR] Step 1: Requesting presigned URL from:', `${API_BASE}/api/upload/presigned-url`);

            const presignedResponse = await fetch(`${API_BASE}/api/upload/presigned-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName,
                    fileType,
                    folder: 'avatars',
                }),
            });

            console.log('📸 [AVATAR] Presigned response status:', presignedResponse.status);

            const presignedData = await presignedResponse.json();
            console.log('📸 [AVATAR] Presigned data:', JSON.stringify(presignedData, null, 2));

            if (!presignedData.success) {
                throw new Error(presignedData.message || 'Failed to get upload URL');
            }

            const { presignedUrl, publicUrl } = presignedData.data;
            console.log('📸 [AVATAR] ✅ Got presigned URL');
            console.log('📸 [AVATAR] Public URL will be:', publicUrl);

            // Step 2: Upload image to S3 using fetch
            console.log('📸 [AVATAR] Step 2: Uploading to S3 via fetch...');
            console.log('📸 [AVATAR] Presigned URL (first 100 chars):', presignedUrl.substring(0, 100) + '...');

            // First, fetch the file URI to get a blob
            console.log('📸 [AVATAR] Converting file URI to blob...');
            const fileResponse = await fetch(uri);
            const blob = await fileResponse.blob();
            console.log('📸 [AVATAR] Blob created, size:', blob.size);

            // Upload the blob to S3
            const uploadResult = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': fileType,
                },
                body: blob,
            });

            console.log('📸 [AVATAR] S3 upload response status:', uploadResult.status);

            if (!uploadResult.ok) {
                const errorText = await uploadResult.text();
                console.log('📸 [AVATAR] ❌ S3 upload error response:', errorText);
                throw new Error(`S3 upload failed with status ${uploadResult.status}`);
            }

            console.log('📸 [AVATAR] ✅ S3 upload successful');

            // Step 3: Update user profile with new avatar URL
            console.log('📸 [AVATAR] Step 3: Updating user profile...');
            const updateResponse = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    avatar: publicUrl,
                }),
            });

            console.log('📸 [AVATAR] Profile update response status:', updateResponse.status);

            const updateData = await updateResponse.json();
            console.log('📸 [AVATAR] Profile update data:', JSON.stringify(updateData, null, 2));

            if (!updateData.success) {
                throw new Error(updateData.error || 'Failed to update profile');
            }
            console.log('📸 [AVATAR] ✅ Profile updated');

            // Step 4: Update local storage
            console.log('📸 [AVATAR] Step 4: Updating local storage...');
            updateUser({ avatar: publicUrl });
            console.log('📸 [AVATAR] ✅ Upload complete!');

            setIsUploading(false);
            return { success: true, avatarUrl: publicUrl };

        } catch (err) {
            console.error('📸 [AVATAR] ❌ Avatar upload error:', err);
            console.error('📸 [AVATAR] Error message:', err.message);
            console.error('📸 [AVATAR] Error stack:', err.stack);
            setError(err.message);
            setIsUploading(false);
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Clear any upload error
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isUploading,
        error,
        uploadAvatar,
        clearError,
    };
};

export default useAvatarUpload;
