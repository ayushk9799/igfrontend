import { useCallback, useEffect, useState } from 'react';
import { useImage } from '@shopify/react-native-skia';
import { preparePuzzleTexture } from '../utils/puzzleTextureCache';

export const usePuzzleTexture = (puzzleId, imageUrl) => {
    const [localUri, setLocalUri] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!imageUrl) {
            setLocalUri(null);
            setStatus('idle');
            return undefined;
        }

        let cancelled = false;
        setStatus('preparing');
        setError(null);
        setLocalUri(null);

        preparePuzzleTexture(puzzleId, imageUrl)
            .then((uri) => {
                if (cancelled) return;
                setLocalUri(uri);
                setStatus('decoding');
            })
            .catch((nextError) => {
                if (cancelled) return;
                setError(nextError);
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [attempt, imageUrl, puzzleId]);

    const handleDecodeError = useCallback((nextError) => {
        setError(nextError);
        setStatus('error');
    }, []);
    const image = useImage(localUri, handleDecodeError);

    useEffect(() => {
        if (localUri && image) {
            setStatus('ready');
        }
    }, [image, localUri]);

    const retry = useCallback(() => {
        setAttempt(previous => previous + 1);
    }, []);

    return {
        image,
        localUri,
        status,
        error,
        retry,
    };
};
