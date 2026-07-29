import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const TEXTURE_SIZE = 1080;
const MAX_CACHED_TEXTURES = 20;
const CACHE_FOLDER = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}jigsaw-textures/`;
const inFlightPreparations = new Map();

const stableHash = (value) => {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 33 + value.charCodeAt(index)) % 2147483647;
    }
    return Math.abs(hash).toString(36);
};

const getImageSize = (uri) => new Promise((resolve, reject) => {
    Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        reject
    );
});

const ensureCacheFolder = async () => {
    const info = await FileSystem.getInfoAsync(CACHE_FOLDER);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
    }
};

const pruneTextureCache = async (protectedUri) => {
    const fileNames = await FileSystem.readDirectoryAsync(CACHE_FOLDER);
    const textureNames = fileNames.filter(name => name.endsWith(`-${TEXTURE_SIZE}.jpg`));
    if (textureNames.length <= MAX_CACHED_TEXTURES) return;

    const entries = await Promise.all(textureNames.map(async (name) => {
        const uri = `${CACHE_FOLDER}${name}`;
        const info = await FileSystem.getInfoAsync(uri);
        return {
            uri,
            modificationTime: info.modificationTime || 0,
        };
    }));

    const removable = entries
        .filter(entry => entry.uri !== protectedUri)
        .sort((left, right) => left.modificationTime - right.modificationTime)
        .slice(0, Math.max(0, entries.length - MAX_CACHED_TEXTURES));
    await Promise.all(removable.map(entry => (
        FileSystem.deleteAsync(entry.uri, { idempotent: true })
    )));
};

const prepareTexture = async (puzzleId, imageUrl) => {
    await ensureCacheFolder();

    const cacheKey = stableHash(`${puzzleId || 'puzzle'}:${imageUrl}`);
    const finalUri = `${CACHE_FOLDER}${cacheKey}-${TEXTURE_SIZE}.jpg`;
    const cached = await FileSystem.getInfoAsync(finalUri);
    if (cached.exists && (cached.size || 0) > 0) {
        return finalUri;
    }

    const downloadUri = `${CACHE_FOLDER}${cacheKey}-download.jpg`;
    await FileSystem.deleteAsync(downloadUri, { idempotent: true });

    try {
        let sourceUri;
        if (imageUrl.startsWith('file://') || imageUrl.startsWith('content://')) {
            await FileSystem.copyAsync({ from: imageUrl, to: downloadUri });
            sourceUri = downloadUri;
        } else {
            const download = await FileSystem.downloadAsync(imageUrl, downloadUri);
            if (download.status < 200 || download.status >= 300) {
                throw new Error(`Puzzle image download failed with status ${download.status}`);
            }
            sourceUri = download.uri;
        }

        const { width, height } = await getImageSize(sourceUri);
        if (width === TEXTURE_SIZE && height === TEXTURE_SIZE) {
            await FileSystem.deleteAsync(finalUri, { idempotent: true });
            await FileSystem.moveAsync({ from: sourceUri, to: finalUri });
            await pruneTextureCache(finalUri).catch(() => {});
            return finalUri;
        }

        const squareSize = Math.min(width, height);
        const originX = Math.max(0, (width - squareSize) / 2);
        const originY = Math.max(0, (height - squareSize) / 2);
        const normalized = await manipulateAsync(
            sourceUri,
            [
                {
                    crop: {
                        originX,
                        originY,
                        width: squareSize,
                        height: squareSize,
                    },
                },
                { resize: { width: TEXTURE_SIZE, height: TEXTURE_SIZE } },
            ],
            {
                compress: 0.88,
                format: SaveFormat.JPEG,
            }
        );

        await FileSystem.deleteAsync(finalUri, { idempotent: true });
        await FileSystem.moveAsync({ from: normalized.uri, to: finalUri });
        await pruneTextureCache(finalUri).catch(() => {});
        return finalUri;
    } finally {
        await FileSystem.deleteAsync(downloadUri, { idempotent: true }).catch(() => {});
    }
};

export const preparePuzzleTexture = (puzzleId, imageUrl) => {
    if (!imageUrl) {
        return Promise.reject(new Error('Puzzle image URL is missing'));
    }

    const identity = `${puzzleId || 'puzzle'}:${imageUrl}`;
    const existing = inFlightPreparations.get(identity);
    if (existing) return existing;

    const preparation = prepareTexture(puzzleId, imageUrl)
        .finally(() => {
            inFlightPreparations.delete(identity);
        });
    inFlightPreparations.set(identity, preparation);
    return preparation;
};

export const prefetchPuzzleTexture = (puzzleId, imageUrl) => {
    if (!imageUrl) return;
    preparePuzzleTexture(puzzleId, imageUrl).catch(() => {});
};

export const PUZZLE_TEXTURE_SIZE = TEXTURE_SIZE;
