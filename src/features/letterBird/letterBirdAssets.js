// Loads the Letter Bird mesh + textures once and keeps the decoded result in memory,
// so re-opening the Letter tab only has to rebuild the GL context (fast) and not re-decode anything.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Skia, ColorType, AlphaType } from '@shopify/react-native-skia';

const SOURCES = {
    bin: require('../../../assets/letter-bird/bird.bin'),
    color: require('../../../assets/letter-bird/bird_color_jpg.bin'),
    mr: require('../../../assets/letter-bird/bird_mr_jpg.bin'),
    normal: require('../../../assets/letter-bird/bird_normal_jpg.bin'),
};

let cached = null;
let pending = null;

async function readBytes(moduleId) {
    const asset = Asset.fromModule(moduleId);
    if (!asset.localUri) await asset.downloadAsync();
    return new File(asset.localUri || asset.uri).bytes();
}

// Textures are JPEGs stored with a .bin extension so Android release packs them in res/raw (readable
// as files) rather than res/drawable. JPEG -> raw RGBA pixels using Skia (already in the app), ready for a three.js DataTexture.
function decodeImage(bytes) {
    const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
    if (!image) throw new Error('Letter bird: could not decode texture');
    const width = image.width(), height = image.height();
    const pixels = image.readPixels(0, 0, {
        width, height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul,
    });
    image.dispose?.();
    if (!pixels) throw new Error('Letter bird: could not read texture pixels');
    return { pixels: pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer), width, height };
}

export function getCachedLetterBirdAssets() {
    return cached;
}

export function loadLetterBirdAssets() {
    if (cached) return Promise.resolve(cached);
    if (pending) return pending;
    pending = (async () => {
        const [bin, color, mr, normal] = await Promise.all([
            readBytes(SOURCES.bin), readBytes(SOURCES.color), readBytes(SOURCES.mr), readBytes(SOURCES.normal),
        ]);
        // own, 4-byte aligned copy so Float32Array / Uint16Array views are valid
        const birdBuffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
        cached = {
            birdBuffer,
            textures: { color: decodeImage(color), mr: decodeImage(mr), normal: decodeImage(normal) },
        };
        return cached;
    })().finally(() => { pending = null; });
    return pending;
}

// Optional: call early (e.g. after login) so the first open of the tab is instant.
export function preloadLetterBirdAssets() {
    loadLetterBirdAssets().catch(() => {});
}
