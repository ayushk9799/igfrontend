import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';

const parseJson = async (response) => {
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.message || data?.error || 'Request failed');
    }
    return data;
};

export const uploadMemoryImage = async (preparedImage) => {
    const presignedResponse = await apiFetch(`${API_BASE}/api/upload/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: preparedImage.fileName,
            fileType: preparedImage.mimeType || 'image/jpeg',
            folder: 'memories',
        }),
    });
    const presignedData = await parseJson(presignedResponse);
    const { presignedUrl, publicUrl, fileKey } = presignedData.data;

    const fileResponse = await fetch(preparedImage.uri);
    const blob = await fileResponse.blob();

    const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': preparedImage.mimeType || 'image/jpeg' },
        body: blob,
    });

    if (!uploadResponse.ok) {
        throw new Error('Photo upload failed');
    }

    return { imageUrl: publicUrl, fileKey };
};

export const createMemory = async (payload) => {
    const response = await fetch(`${API_BASE}/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
