// Notification Center Screen — lists pending duel actions
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
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

// Back arrow icon
const BackIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
            d="M19 12H5M12 19l-7-7 7-7"
            stroke="#FFFFFF"
            strokeWidth={2}
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
            stroke="rgba(255,255,255,0.4)"
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
        <View style={[styles.iconCircle, { backgroundColor: item.color }]}>
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
                    stroke="rgba(255,255,255,0.3)"
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

const NotificationCenterScreen = ({
    onBack,
    onJigsawPlay,
    onTicTacToePress,
    onWordlePress,
}) => {
    const notifications = useSelector(selectDuelNotifications);

    const handleNotificationPress = (item) => {
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
    };

    return (
        <View style={styles.root}>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <BackIcon />
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
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    container: {
        flex: 1,
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 40,
    },
    // List
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
    },
    // Notification Item
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContent: {
        flex: 1,
        marginLeft: 14,
    },
    notifTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 3,
    },
    notifMessage: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.6)',
    },
    // Empty state
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.4)',
        textAlign: 'center',
    },
});

export default NotificationCenterScreen;
