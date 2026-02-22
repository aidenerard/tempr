import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Image,
    Pressable,
    ViewToken,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import { useAuth } from "@/lib/AuthContext";
import { getTopTracks, SpotifyTrack } from "@/lib/spotify";
import { findMusicVideo, YouTubeMatch } from "@/lib/youtube";
import { theme } from "@/constants/Colors";

type FeedItem = {
    track: SpotifyTrack;
    match: YouTubeMatch | null;
    matchLoading: boolean;
};

const VideoCard = React.memo(
    ({
        item,
        isActive,
        isMuted,
        onUnmute,
        width,
        height,
    }: {
        item: FeedItem;
        isActive: boolean;
        isMuted: boolean;
        onUnmute: () => void;
        width: number;
        height: number;
    }) => {
        const albumArt = item.track.album.images[0]?.url;
        const artist = item.track.artists[0]?.name ?? "";
        const showVideo = isActive && item.match != null;

        // Cover-fill: scale the 16:9 video to fill full screen height, crop sides
        const playerH = height;
        const playerW = Math.ceil(height * (16 / 9));
        const offsetX = -Math.floor((playerW - width) / 2);

        return (
            <View style={[styles.card, { width, height }]}>
                {showVideo ? (
                    <View style={[styles.playerWrap, { width, height }]}>
                        <View style={{ position: "absolute", left: offsetX, top: 0, width: playerW, height: playerH }}>
                            <YoutubePlayer
                                videoId={item.match!.videoId}
                                width={playerW}
                                height={playerH}
                                play={isActive}
                                mute={isMuted}
                                forceAndroidAutoplay
                                webViewProps={{
                                    allowsInlineMediaPlayback: true,
                                    mediaPlaybackRequiresUserAction: false,
                                    scrollEnabled: false,
                                }}
                                initialPlayerParams={{
                                    controls: false,
                                    rel: false,
                                    modestbranding: true,
                                    playsinline: true,
                                }}
                            />
                        </View>
                    </View>
                ) : (
                    <Image
                        source={{ uri: albumArt }}
                        style={[StyleSheet.absoluteFill, { resizeMode: "cover" }]}
                    />
                )}

                <View style={styles.scrim} pointerEvents="none" />

                {isActive && item.matchLoading && (
                    <View style={styles.spinnerOverlay} pointerEvents="none">
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={styles.spinnerText}>Finding video…</Text>
                    </View>
                )}

                {/* Tap-to-unmute badge — shown while muted on the active playing card */}
                {isActive && showVideo && isMuted && (
                    <Pressable style={styles.muteBadge} onPress={onUnmute}>
                        <Text style={styles.muteBadgeText}>🔇 Tap to unmute</Text>
                    </Pressable>
                )}

                <View style={styles.trackInfo}>
                    <Image source={{ uri: albumArt }} style={styles.thumbnail} />
                    <View style={styles.trackText}>
                        <Text style={styles.songTitle} numberOfLines={1}>
                            {item.track.name}
                        </Text>
                        <Text style={styles.artistName} numberOfLines={1}>
                            {artist}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }
);

export default function DiscoverScreen() {
    const { spotifyToken } = useAuth();
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    // Start muted so iOS allows autoplay; unmutes permanently after first user tap
    const [isMuted, setIsMuted] = useState(true);

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

    useEffect(() => {
        if (!spotifyToken) return;
        loadFeed(spotifyToken);
    }, [spotifyToken]);

    async function loadFeed(token: string) {
        try {
            setInitialLoading(true);
            setError(null);

            const tracks = await getTopTracks(token, 8);

            const items: FeedItem[] = tracks.map((track) => ({
                track,
                match: null,
                matchLoading: true,
            }));

            setFeedItems(items);
            setInitialLoading(false);

            tracks.forEach((track, index) => {
                findMusicVideo(track.id)
                    .then((match) => {
                        setFeedItems((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], match, matchLoading: false };
                            return next;
                        });
                    })
                    .catch(() => {
                        setFeedItems((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], match: null, matchLoading: false };
                            return next;
                        });
                    });
            });
        } catch (e: any) {
            setError(e?.message ?? "Failed to load feed");
            setInitialLoading(false);
        }
    }

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index != null) {
                setCurrentIndex(viewableItems[0].index);
            }
        },
        []
    );

    const handleUnmute = useCallback(() => setIsMuted(false), []);

    if (initialLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Loading your feed…</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View
            style={styles.container}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setContainerSize({ width, height });
            }}
        >
            {containerSize.width > 0 && containerSize.height > 0 && (
                <FlatList
                    data={feedItems}
                    keyExtractor={(item) => item.track.id}
                    renderItem={({ item, index }) => (
                        <VideoCard
                            item={item}
                            isActive={index === currentIndex}
                            isMuted={isMuted}
                            onUnmute={handleUnmute}
                            width={containerSize.width}
                            height={containerSize.height}
                        />
                    )}
                    pagingEnabled
                    showsVerticalScrollIndicator={false}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig.current}
                    getItemLayout={(_, index) => ({
                        length: containerSize.height,
                        offset: containerSize.height * index,
                        index,
                    })}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    center: {
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    card: {
        backgroundColor: "#000",
        overflow: "hidden",
    },
    playerWrap: {
        ...StyleSheet.absoluteFillObject,
        overflow: "hidden",
        backgroundColor: "#000",
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.25)",
    },
    spinnerOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    loadingText: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
    },
    muteBadge: {
        position: "absolute",
        top: 16,
        right: 16,
        backgroundColor: "rgba(0,0,0,0.55)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    muteBadgeText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
    },
    trackInfo: {
        position: "absolute",
        bottom: 24,
        left: 16,
        right: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 6,
    },
    trackText: {
        flex: 1,
    },
    songTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    artistName: {
        color: "rgba(255,255,255,0.75)",
        fontSize: 13,
        marginTop: 2,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    spinnerText: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 14,
    },
    errorText: {
        color: theme.textSecondary,
        fontSize: 14,
        textAlign: "center",
        paddingHorizontal: 32,
    },
});
