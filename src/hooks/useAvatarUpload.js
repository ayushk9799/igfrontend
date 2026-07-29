// useAvatarUpload - Custom hook for managing avatar upload to S3
import { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { API_BASE } from '../constants/Api';
import { getUser, updateUser } from '../utils/authStorage';
import { updateUser as updateUserRedux } from '../store/slices/userSlice';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { apiFetch } from '../utils/apiFetch';


/**
 * Custom hook for uploading user avatar to S3
 * Handles the full flow: get presigned URL -> upload to S3 -> update user profile
 */
export const useAvatarUpload = () => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const dispatch = useDispatch();


    // Generate a small thumbnail before converting it to Base64. Keeping the
    // full-resolution avatar in Redux/storage can consume several megabytes.
    const uriToBase64 = async (uri) => {
        try {
            const context = ImageManipulator.manipulate(uri);
            context.resize({ width: 128, height: 128 });
            const rendered = await context.renderAsync();
            const thumbnail = await rendered.saveAsync({
                compress: 0.72,
                format: SaveFormat.JPEG,
            });
            const response = await fetch(thumbnail.uri);
            const blob = await response.blob();

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (conversionError) {
            console.error('B64 conversion error:', conversionError);
            return null;
        }
    };

    const uploadAvatar = useCallback(async (imageAsset) => {

        const user = getUser();

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

            // Step 1: Get presigned URL from backend
            const presignedResponse = await apiFetch(`${API_BASE}/api/upload/presigned-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName,
                    fileType,
                    folder: 'avatars',
                }),
            });

            const presignedData = await presignedResponse.json();
            if (!presignedData.success) {
                throw new Error(presignedData.message || 'Failed to get upload URL');
            }

            const { presignedUrl, publicUrl } = presignedData.data;
            const fileResponse = await fetch(uri);
            const blob = await fileResponse.blob();
            const uploadResult = await fetch(presignedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': fileType,
                },
                body: blob,
            });

            if (!uploadResult.ok) {
                await uploadResult.text();
                throw new Error(`S3 upload failed with status ${uploadResult.status}`);
            }

            // Step 3: Update user profile with new avatar URL
            const updateResponse = await apiFetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    avatar: publicUrl,
                }),
            });
            const updateData = await updateResponse.json();
            if (!updateData.success) {
                throw new Error(updateData.error || 'Failed to update profile');
            }

            // Step 4: Generate Base64 thumbnail locally for instant access
            let thumbnail = null;
            try {
                thumbnail = await uriToBase64(uri);
            } catch (thumbErr) {
                console.warn('Failed to generate local thumbnail', thumbErr);
            }

            // Step 5: Update local storage with URL and thumbnail
            const onboarding = updateData.user?.onboarding || user.onboarding || null;
            updateUser({ avatar: publicUrl, avatarThumbnail: thumbnail, onboarding });
            dispatch(updateUserRedux({ avatar: publicUrl, avatarThumbnail: thumbnail, onboarding }));

            setIsUploading(false);
            return { success: true, avatarUrl: publicUrl, avatarThumbnail: thumbnail };

        } catch (err) {
            console.error('📸 [AVATAR] ❌ Avatar upload error:', err);
            console.error('📸 [AVATAR] Error message:', err.message);
            // console.error('📸 [AVATAR] Error stack:', err.stack);
            setError(err.message);
            setIsUploading(false);
            return { success: false, error: err.message };
        }
    }, [dispatch]);

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
