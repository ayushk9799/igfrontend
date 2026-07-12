import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.82;

const normalizeUri = (uri) => {
    if (!uri) return null;
    return uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
};

const getImageSize = (uri) => new Promise((resolve) => {
    Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve({ width: null, height: null })
    );
});

const parseExifDateString = (value, offsetValue) => {
    if (!value || typeof value !== 'string') return null;

    const match = value.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const isoLocal = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    const isoWithOffset = offsetValue && /^[+-]\d{2}:\d{2}$/.test(offsetValue)
        ? `${isoLocal}${offsetValue}`
        : isoLocal;
    const parsed = new Date(isoWithOffset);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getCapturedDateFromAsset = (asset) => {
    const exif = asset?.exif || {};
    const candidates = [
        exif.DateTimeOriginal,
        exif.DateTimeDigitized,
        exif.DateTime,
        exif.dateTimeOriginal,
        exif.dateTime,
    ];
    const offsetValue = exif.OffsetTimeOriginal || exif.OffsetTime || exif.offsetTimeOriginal;

    for (const candidate of candidates) {
        const parsed = parseExifDateString(candidate, offsetValue);
        if (parsed) {
            return {
                capturedAt: parsed,
                capturedAtSource: 'exif',
            };
        }
    }

    if (asset?.creationTime) {
        const parsed = new Date(asset.creationTime);
        if (!Number.isNaN(parsed.getTime())) {
            return {
                capturedAt: parsed,
                capturedAtSource: 'exif',
            };
        }
    }

    return {
        capturedAt: new Date(),
        capturedAtSource: 'upload_time',
    };
};

export const prepareMemoryImage = async (asset) => {
    const sourceUri = normalizeUri(asset?.uri);
    if (!sourceUri) {
        throw new Error('No photo selected');
    }

    const sourceSize = asset?.width && asset?.height
        ? { width: asset.width, height: asset.height }
        : await getImageSize(sourceUri);

    const width = Number(sourceSize.width) || null;
    const height = Number(sourceSize.height) || null;
    const longEdge = width && height ? Math.max(width, height) : 0;
    const actions = [];

    if (longEdge > MAX_LONG_EDGE && width && height) {
        actions.push(width >= height
            ? { resize: { width: MAX_LONG_EDGE } }
            : { resize: { height: MAX_LONG_EDGE } });
    }

    const result = await manipulateAsync(
        sourceUri,
        actions,
        { compress: JPEG_QUALITY, format: SaveFormat.JPEG }
    );

    const outputUri = normalizeUri(result.uri);
    const outputSize = result.width && result.height
        ? { width: result.width, height: result.height }
        : await getImageSize(outputUri);

    return {
        uri: outputUri,
        width: outputSize.width || width,
        height: outputSize.height || height,
        fileName: `memory_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
    };
};

export const getDisplayAspectRatio = (width, height) => {
    if (!width || !height) return 4 / 5;

    const ratio = width / height;
    return Math.max(0.72, Math.min(1.35, ratio));
};
