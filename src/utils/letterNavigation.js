// Hands a letter id from a notification tap to the tab navigator, whether
// or not it is mounted yet (cold start vs. app already open).
let pendingLetterId = null;
const listeners = new Set();

export const openLetterFromNotification = (letterId) => {
    if (!letterId) return;
    pendingLetterId = String(letterId);
    listeners.forEach((listener) => listener(pendingLetterId));
};

export const consumePendingLetter = () => {
    const letterId = pendingLetterId;
    pendingLetterId = null;
    return letterId;
};

export const subscribePendingLetter = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
