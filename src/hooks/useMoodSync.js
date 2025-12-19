// useMoodSync - Hook for real-time mood synchronization
import { useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';

/**
 * Hook for mood sync with partner via WebSocket
 * @returns {{
 *   partnerMood: object|null,
 *   updateMood: (emoji: string, label: string) => void,
 *   refreshPartnerMood: () => void
 * }}
 */
export const useMoodSync = () => {
    const { socket, isConnected, partnerMood } = useSocketContext();

    /**
     * Update your mood and broadcast to partner
     */
    const updateMood = useCallback((emoji, label) => {
        if (!socket || !isConnected) {
            console.warn('Socket not connected, cannot update mood');
            return;
        }

        socket.emit('mood:update', { emoji, label });
    }, [socket, isConnected]);

    /**
     * Request partner's current mood
     */
    const refreshPartnerMood = useCallback(() => {
        if (!socket || !isConnected) {
            return;
        }

        socket.emit('mood:getPartner');
    }, [socket, isConnected]);

    return {
        partnerMood,
        updateMood,
        refreshPartnerMood,
    };
};

export default useMoodSync;
