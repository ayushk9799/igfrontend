/**
 * Date utilities for consistent timezone handling across the app
 */

/**
 * Get the user's local date in YYYY-MM-DD format
 * Used for daily challenge date matching to avoid timezone issues with server
 */
export const getLocalDateString = (date = new Date()) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Format a date for display (e.g., "Jan 21, 2026")
 */
export const formatDisplayDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

/**
 * Check if a date string matches today's date
 */
export const isToday = (dateString) => {
    return dateString === getLocalDateString();
};
