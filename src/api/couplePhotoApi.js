import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { API_BASE } from '../constants/Api';

const MAX_LONG_EDGE = 1440;

const parseResponse = async (response) => {
    const data = await response.json();
    if (!response.ok || data?.success === false) {
        throw new Error(data?.message || 'Photo request failed');
    }
    return data.data;
};

export const prepareCouplePhoto = async (asset) => {
    if (!asset?.uri) throw new Error('No photo selected');

    const width = Number(asset.width) || null;
    const height = Number(asset.height) || null;
    const longEdge = width && height ? Math.max(width, height) : 0;
    const actions = [];

    if (longEdge > MAX_LONG_EDGE) {
        actions.push(width >= height
            ? { resize: { width: MAX_LONG_EDGE } }
            : { resize: { height: MAX_LONG_EDGE } });
    }

    const result = await manipulateAsync(asset.uri, actions, {
        compress: 0.82,
        format: SaveFormat.JPEG,
    });

    return {
        uri: result.uri,
        width: result.width || width,
        height: result.height || height,
        mimeType: 'image/jpeg',
    };
};

export const fetchCurrentCouplePhotos = async (userId) => {
    const response = await fetch(`${API_BASE}/api/couple-photo/current?userId=${encodeURIComponent(userId)}`);
    return parseResponse(response);
};

export const sendCurrentCouplePhoto = async ({ userId, asset }) => {
    const prepared = await prepareCouplePhoto(asset);
    const uploadUrlResponse = await fetch(`${API_BASE}/api/couple-photo/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fileType: prepared.mimeType }),
    });
    const upload = await parseResponse(uploadUrlResponse);

    const fileResponse = await fetch(prepared.uri);
    const blob = await fileResponse.blob();
    const s3Response = await fetch(upload.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': prepared.mimeType },
        body: blob,
    });
    if (!s3Response.ok) throw new Error('Photo upload failed');

    const commitResponse = await fetch(`${API_BASE}/api/couple-photo/current`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            fileKey: upload.fileKey,
            revision: upload.revision,
            width: prepared.width,
            height: prepared.height,
            mimeType: prepared.mimeType,
        }),
    });

    return parseResponse(commitResponse);
};
