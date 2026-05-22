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
    const { socket, isConnected, partnerMood, moodHistory, partnerMoodHistory, refreshMoodHistory } = useSocketContext();

    /**
     * Update your mood and broadcast to partner
     */
    const updateMood = useCallback((id, emoji, label) => {
        if (!socket || !isConnected) {
            console.warn('Socket not connected, cannot update mood');
            return;
        }

        let timezone = null;
        try {
            timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (error) {
            timezone = null;
        }

        socket.emit('mood:update', {
            id,
            emoji,
            label,
            timezone,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        });
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
        moodHistory,
        partnerMoodHistory,
        updateMood,
        refreshPartnerMood,
        refreshMoodHistory,
    };
};

export default useMoodSync;
