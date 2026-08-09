import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';

const parseJson = async (response) => {
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || 'Request failed');
    }
    return data;
};

export const requestMemoryImageUpload = async ({ fileName, mimeType = 'image/jpeg' }) => {
    const presignedResponse = await apiFetch(`${API_BASE}/api/upload/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName,
            fileType: mimeType,
            folder: 'memories',
        }),
    });
    const presignedData = await parseJson(presignedResponse);
    return presignedData.data;
};

export const uploadMemoryImage = async (preparedImage, uploadTarget = null) => {
    let target = uploadTarget || await requestMemoryImageUpload({
        fileName: preparedImage.fileName,
        mimeType: preparedImage.mimeType || 'image/jpeg',
    });

    const fileResponse = await fetch(preparedImage.uri);
    const blob = await fileResponse.blob();

    const putImage = (presignedUrl) => fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': preparedImage.mimeType || 'image/jpeg' },
        body: blob,
    });

    let uploadResponse = null;
    try {
        uploadResponse = await putImage(target.presignedUrl);
    } catch (error) {
        if (!uploadTarget) throw error;
    }

    // A URL warmed while the user edits can expire, or a mobile connection can
    // briefly drop. Refresh it once rather than making them choose the photo again.
    if (!uploadResponse?.ok && uploadTarget) {
        target = await requestMemoryImageUpload({
            fileName: preparedImage.fileName,
            mimeType: preparedImage.mimeType || 'image/jpeg',
        });
        uploadResponse = await putImage(target.presignedUrl);
    }

    if (!uploadResponse?.ok) {
        throw new Error('Photo upload failed');
    }

    return { imageUrl: target.publicUrl, fileKey: target.fileKey };
};

export const createMemory = async (payload) => {
    const response = await fetch(`${API_BASE}/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only this new client opts into returning as soon as the memory is
        // durable. Older app builds omit the flag and retain their old flow.
        body: JSON.stringify({ ...payload, notifyPartnerAsync: true }),
    });
    const data = await parseJson(response);
    return data.data;
};

export const fetchMemories = async ({ userId, cursor = null, limit = 20 }) => {
    const params = new URLSearchParams({
        userId,
        limit: String(limit),
    });

    if (cursor) {
        params.set('cursor', cursor);
    }

    const response = await fetch(`${API_BASE}/api/memories?${params.toString()}`);
    const data = await parseJson(response);
    return data.data;
};

export const deleteMemory = async ({ userId, memoryId }) => {
    const response = await fetch(`${API_BASE}/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    const data = await parseJson(response);
    return data.data;
};
