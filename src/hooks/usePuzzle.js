// usePuzzle - Custom hook for managing jigsaw puzzles
import { useState, useCallback } from 'react';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';

/**
 * Custom hook for puzzle operations
 * Handles: create puzzle, fetch pending, move pieces, mark solved
 */
export const usePuzzle = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [pendingPuzzles, setPendingPuzzles] = useState([]);

    /**
     * Upload image to S3 and create a puzzle
     */
    const createPuzzle = useCallback(async (imageAsset, partnerId, gridSize = { rows: 3, cols: 3 }) => {
        console.log('🧩 [PUZZLE] Starting puzzle creation...');

        const user = getUser();
        if (!user?.id) {
            return { success: false, error: 'User not authenticated' };
        }

        setIsUploading(true);
        setError(null);

        try {
            // Extract file info
            const uri = imageAsset.uri;
            const fileName = imageAsset.fileName || `puzzle_${Date.now()}.jpg`;
            const fileType = imageAsset.mimeType || 'image/jpeg';

            console.log('🧩 [PUZZLE] File info:', { uri, fileName, fileType });

            // Step 1: Get presigned URL
            console.log('🧩 [PUZZLE] Getting presigned URL...');
            const presignedResponse = await fetch(`${API_BASE}/api/upload/presigned-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName,
                    fileType,
                    folder: 'puzzles',
                }),
            });

            const presignedData = await presignedResponse.json();
            if (!presignedData.success) {
                throw new Error(presignedData.message || 'Failed to get upload URL');
            }

            const { presignedUrl, publicUrl } = presignedData.data;
            console.log('🧩 [PUZZLE] ✅ Got presigned URL');

            // Step 2: Upload to S3
            console.log('🧩 [PUZZLE] Uploading to S3...');
            const fileResponse = await fetch(uri);
            const blob = await fileResponse.blob();

            const uploadResult = await fetch(presignedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': fileType },
                body: blob,
            });

            if (!uploadResult.ok) {
                throw new Error('S3 upload failed');
            }
            console.log('🧩 [PUZZLE] ✅ S3 upload successful');

            // Step 3: Create puzzle in backend
            console.log('🧩 [PUZZLE] Creating puzzle record...');
            const puzzleResponse = await fetch(`${API_BASE}/api/puzzle/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: user.id,
                    partnerId,
                    imageUrl: publicUrl,
                    gridSize,
                }),
            });

            const puzzleData = await puzzleResponse.json();
            if (!puzzleData.success) {
                throw new Error(puzzleData.message || 'Failed to create puzzle');
            }

            console.log('🧩 [PUZZLE] ✅ Puzzle created!', puzzleData.data);
            setIsUploading(false);
            return { success: true, puzzle: puzzleData.data };

        } catch (err) {
            console.error('🧩 [PUZZLE] ❌ Error:', err);
            setError(err.message);
            setIsUploading(false);
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Fetch pending puzzles for the current user
     */
    const fetchPendingPuzzles = useCallback(async () => {
        const user = getUser();
        if (!user?.id) return { success: false, error: 'Not authenticated' };

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/puzzle/pending/${user.id}`);
            const data = await response.json();

            if (data.success) {
                setPendingPuzzles(data.data);
                console.log('🧩 [PUZZLE] Pending puzzles:', data.data.length);
            }
            setIsLoading(false);
            return { success: true, puzzles: data.data };

        } catch (err) {
            console.error('🧩 [PUZZLE] Fetch error:', err);
            setIsLoading(false);
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Get a specific puzzle by ID
     */
    const getPuzzle = useCallback(async (puzzleId) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}`);
            const data = await response.json();
            setIsLoading(false);
            return data;
        } catch (err) {
            setIsLoading(false);
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Record a piece move
     */
    const movePiece = useCallback(async (puzzleId, fromIndex, toIndex) => {
        try {
            const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromIndex, toIndex }),
            });
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, []);

    /**
     * Mark puzzle as solved
     */
    const solvePuzzle = useCallback(async (puzzleId) => {
        try {
            const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/solve`, {
                method: 'POST',
            });
            return await response.json();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, []);

    const clearError = useCallback(() => setError(null), []);

    return {
        isLoading,
        isUploading,
        error,
        pendingPuzzles,
        createPuzzle,
        fetchPendingPuzzles,
        getPuzzle,
        movePiece,
        solvePuzzle,
        clearError,
    };
};

export default usePuzzle;
