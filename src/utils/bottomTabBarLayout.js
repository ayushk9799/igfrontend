import { Platform } from 'react-native';

export const TAB_BAR_CONTENT_HEIGHT = 48;
export const TAB_BAR_SURFACE_PADDING = 4;
export const TAB_BAR_BORDER_WIDTH = 1;

export const getTabBarBottomOffset = (bottomInset) => (
    Platform.OS === 'android'
        ? Math.max(bottomInset, 12)
        : (bottomInset > 0 ? Math.max(bottomInset - 18, 12) : 12)
);

// Reserve the dock's full height plus a small gap for tappable content.
export const getTabBarClearance = (bottomInset) => (
    getTabBarBottomOffset(bottomInset)
    + TAB_BAR_CONTENT_HEIGHT
    + 2 * TAB_BAR_SURFACE_PADDING
    + 2 * TAB_BAR_BORDER_WIDTH
    + 12
);
