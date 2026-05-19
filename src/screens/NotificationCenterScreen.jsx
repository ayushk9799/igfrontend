// Notification Center Screen — lists pending duel actions
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Platform,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useSelector } from 'react-redux';
import { selectDuelNotifications } from '../store/slices/notificationsSlice';

// Game-specific icons
const PuzzleIcon = ({ size = 22 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z"
            fill="#FFFFFF"
        />
    </Svg>
);

const TicTacToeIcon = ({ size = 22 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M8 4v16M16 4v16M4 8h16M4 16h16"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
        />
    </Svg>
);

const WordleIcon = ({ size = 22 }) => (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.7, fontWeight: '900', color: '#FFFFFF' }}>W</Text>
    </View>
);

// Close icon for modal dismiss
const CloseIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18 6L6 18M6 6l12 12"
            stroke="#050E3E"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

// Chevron right icon
const ChevronRight = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M9 18l6-6-6-6"
            stroke="#FFB5D0"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const getIconForType = (type) => {
    switch (type) {
        case 'puzzle':
            return <PuzzleIcon />;
        case 'tictactoe':
            return <TicTacToeIcon />;
        case 'wordle':
            return <WordleIcon />;
        default:
            return null;
    }
};

const NotificationItem = ({ item, onPress }) => (
    <TouchableOpacity
        style={styles.notificationItem}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
    >
        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: item.color || '#FF5E97' }]}>
            {getIconForType(item.type)}
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
            <Text style={styles.notifTitle}>{item.title}</Text>
            <Text style={styles.notifMessage}>{item.message}</Text>
        </View>

        {/* Chevron */}
        <ChevronRight />
    </TouchableOpacity>
);

const EmptyState = () => (
    <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path
                    d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                    stroke="#FF5E97"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </View>
        <Text style={styles.emptyTitle}>You're all caught up!</Text>
        <Text style={styles.emptySubtitle}>No pending duels right now.</Text>
    </View>
);

export const NotificationCenterScreen = ({
    onBack,
    onJigsawPlay,
    onTicTacToePress,
    onWordlePress,
}) => {
    const notifications = useSelector(selectDuelNotifications);
    const insets = useSafeAreaInsets();

    const handleNotificationPress = (item) => {
        // Dismiss first to return to main tab state before firing sub-flows
        if (onBack) {
            onBack();
        }
        
        // Wait slightly for modal dismiss transition
        setTimeout(() => {
            switch (item.type) {
                case 'puzzle':
                    onJigsawPlay?.(item.game);
                    break;
                case 'tictactoe':
                    onTicTacToePress?.(item.game);
                    break;
                case 'wordle':
                    onWordlePress?.(item.game);
                    break;
            }
        }, 300);
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.gradient}
            >
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <CloseIcon />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Content */}
                {notifications.length === 0 ? (
                    <EmptyState />
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <NotificationItem
                                item={item}
                                onPress={handleNotificationPress}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    closeButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#050E3E',
        letterSpacing: -0.5,
    },
    headerSpacer: {
        width: 38,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 60,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    iconCircle: {
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContent: {
        flex: 1,
        marginLeft: 14,
    },
    notifTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#050E3E',
        marginBottom: 2,
    },
    notifMessage: {
        fontSize: 13,
        fontWeight: '500',
        color: '#7380A1',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingBottom: 80,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#050E3E',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#7380A1',
        textAlign: 'center',
    },
});

export default NotificationCenterScreen;
