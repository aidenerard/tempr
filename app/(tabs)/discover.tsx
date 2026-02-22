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
import { WebView } from "react-native-webview";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/AuthContext";
import { getTrendingTracks, SpotifyTrack } from "@/lib/spotify";
import { findMusicVideo, YouTubeMatch } from "@/lib/youtube";
import { loadPreviewPlaylist } from "@/lib/queueStorage";
import { theme } from "@/constants/Colors";

const WEB_ORIGIN = __DEV__ ? "https://app.local" : "https://yourdomain.com";

function buildYouTubeHtml(videoId: string, origin: string, startSeconds: number): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="origin">
  <style>
    *{margin:0;padding:0}
    html,body{width:100%;height:100%;background:#000;overflow:hidden}
    #p{width:100%;height:100%}
  </style>
</head>
<body>
  <div id="p"></div>

  <script>
    var tag=document.createElement('script');
    tag.src='https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    var player;
    var active=false;

    function onYouTubeIframeAPIReady(){
      player=new YT.Player('p',{
        width:'100%',
        height:'100%',
        videoId:'${videoId}',
        playerVars:{
          autoplay:1,
          mute:1,
          start:${startSeconds},
          playsinline:1,
          controls:0,
          rel:0,
          modestbranding:1,
          enablejsapi:1,
          origin:'${origin}',
          cc_load_policy:0
        },
        events:{
          onReady:function(e){
            try { e.target.playVideo(); } catch(err) {}
          },
          onStateChange:function(e){
            if(e.data===1 && active){
              try { player.unMute(); player.setVolume(100); } catch(err) {}
            }
          }
        }
      });
    }

    function handle(msg){
      var data = msg && msg.data ? msg.data : msg;
      if(data==='activate'){
        active=true;
        if(player){ try{ player.unMute(); player.setVolume(100); player.playVideo(); }catch(e){} }
      }
      if(data==='deactivate'){
        active=false;
        if(player){ try{ player.mute(); player.pauseVideo(); }catch(e){} }
      }
    }
    document.addEventListener('message',handle);
    window.addEventListener('message',handle);
  </script>
</body>
</html>`;
}

type FeedItem = {
    track: SpotifyTrack;
    match: YouTubeMatch | null;
    matchLoading: boolean;
};

type Tab = "findMusic" | "preview";

const VideoCard = React.memo(
    ({
         item,
         isActive,
         isNear,
         width,
         height,
     }: {
        item: FeedItem;
        isActive: boolean;
        isNear: boolean;
        width: number;
        height: number;
    }) => {
        const albumArt = item.track.album.images[0]?.url;
        const artist = item.track.artists[0]?.name ?? "";
        const showVideo = item.match != null && isNear;

        const playerH = Math.round(height * 0.75);
        const playerW = Math.ceil(playerH * (16 / 9));
        const offsetX = -Math.floor((playerW - width) / 2);
        const offsetY = Math.floor((height - playerH) / 2);

        const webViewRef = useRef<WebView>(null);
        const wasActive = useRef(false);

        useEffect(() => {
            if (!webViewRef.current || !item.match) return;
            if (isActive && !wasActive.current) {
                webViewRef.current.injectJavaScript("handle({data:'activate'});true;");
            } else if (!isActive && wasActive.current) {
                webViewRef.current.injectJavaScript("handle({data:'deactivate'});true;");
            }
            wasActive.current = isActive;
        }, [isActive, item.match]);

        return (
            <View style={[styles.card, { width, height }]}>
                {showVideo ? (
                    <View style={[styles.playerWrap, { width, height }]}>
                        <View
                            style={{
                                position: "absolute",
                                left: offsetX,
                                top: offsetY,
                                width: playerW,
                                height: playerH,
                            }}
                        >
                            <WebView
                                ref={webViewRef}
                                source={{
                                    html: buildYouTubeHtml(item.match!.videoId, WEB_ORIGIN, item.match!.startSeconds),
                                    baseUrl: WEB_ORIGIN,
                                }}
                                originWhitelist={["https://*", "http://*"]}
                                style={{ width: playerW, height: playerH, backgroundColor: "#000" }}
                                allowsInlineMediaPlayback
                                mediaPlaybackRequiresUserAction={false}
                                javaScriptEnabled
                                scrollEnabled={false}
                                allowsFullscreenVideo={false}
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
    const { spotifyToken, refreshSpotifyToken, signOut } = useAuth();
    const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

    const [activeTab, setActiveTab] = useState<Tab>("findMusic");
    const [screenFocused, setScreenFocused] = useState(true);

    // Find Music state
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const seenIds = useRef<Set<string>>(new Set());

    // Preview state
    const [previewItems, setPreviewItems] = useState<FeedItem[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewEmpty, setPreviewEmpty] = useState(false);
    const previewTrackIds = useRef<string[]>([]);

    // Shared
    const [currentIndex, setCurrentIndex] = useState(0);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

    useEffect(() => {
        if (!spotifyToken) return;
        loadFeed(spotifyToken);
    }, [spotifyToken]);

    // Reload preview whenever Discover tab comes into focus (catches new playlists from Generate)
    useFocusEffect(
        useCallback(() => {
            setScreenFocused(true);
            if (tabParam === "preview") {
                setActiveTab("preview");
                setCurrentIndex(0);
            }
            loadPreview();
            return () => setScreenFocused(false);
        }, [spotifyToken, tabParam])
    );

    async function loadFeed(token: string) {
        try {
            setInitialLoading(true);
            setError(null);
            seenIds.current = new Set();

            const raw = await getTrendingTracks(token, 20);
            const tracks = raw.filter((t) => !seenIds.current.has(t.id)).slice(0, 10);
            tracks.forEach((t) => seenIds.current.add(t.id));

            const items: FeedItem[] = tracks.map((track) => ({
                track,
                match: null,
                matchLoading: true,
            }));

            setFeedItems(items);
            setInitialLoading(false);

            tracks.forEach((track, index) => {
                findMusicVideo(track, token)
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
            const msg: string = e?.message ?? "";
            if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("401")) {
                const refreshed = await refreshSpotifyToken();
                if (!refreshed) await signOut();
                return;
            }
            setError(msg || "Failed to load feed");
            setInitialLoading(false);
        }
    }

    async function loadMore() {
        if (!spotifyToken || loadingMore) return;
        setLoadingMore(true);
        try {
            const raw = await getTrendingTracks(spotifyToken, 20);
            const tracks = raw.filter((t) => !seenIds.current.has(t.id)).slice(0, 10);
            tracks.forEach((t) => seenIds.current.add(t.id));
            const startIndex = feedItems.length;
            const newItems: FeedItem[] = tracks.map((track) => ({
                track,
                match: null,
                matchLoading: true,
            }));
            setFeedItems((prev) => [...prev, ...newItems]);

            tracks.forEach((track, i) => {
                findMusicVideo(track, spotifyToken)
                    .then((match) => {
                        setFeedItems((prev) => {
                            const next = [...prev];
                            next[startIndex + i] = { ...next[startIndex + i], match, matchLoading: false };
                            return next;
                        });
                    })
                    .catch(() => {
                        setFeedItems((prev) => {
                            const next = [...prev];
                            next[startIndex + i] = { ...next[startIndex + i], match: null, matchLoading: false };
                            return next;
                        });
                    });
            });
        } catch (e: any) {
            console.warn("[Discover] loadMore error:", e.message);
        } finally {
            setLoadingMore(false);
        }
    }

    async function loadPreview() {
        if (!spotifyToken) return;
        const tracks: SpotifyTrack[] = await loadPreviewPlaylist();

        if (tracks.length === 0) {
            setPreviewEmpty(true);
            return;
        }

        // Skip re-running findMusicVideo if the playlist hasn't changed
        const ids = tracks.map((t) => t.id);
        if (JSON.stringify(ids) === JSON.stringify(previewTrackIds.current)) return;
        previewTrackIds.current = ids;

        setPreviewEmpty(false);
        setPreviewLoading(true);

        const items: FeedItem[] = tracks.map((track) => ({
            track,
            match: null,
            matchLoading: true,
        }));
        setPreviewItems(items);
        setPreviewLoading(false);

        tracks.forEach((track, index) => {
            findMusicVideo(track, spotifyToken)
                .then((match) => {
                    setPreviewItems((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], match, matchLoading: false };
                        return next;
                    });
                })
                .catch(() => {
                    setPreviewItems((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], match: null, matchLoading: false };
                        return next;
                    });
                });
        });
    }

    function handleTabChange(tab: Tab) {
        setActiveTab(tab);
        setCurrentIndex(0);
    }

    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index != null) {
                setCurrentIndex(viewableItems[0].index);
            }
        },
        []
    );

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

    const activeItems = activeTab === "findMusic" ? feedItems : previewItems;

    return (
        <View
            style={styles.container}
            onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setContainerSize({ width, height });
            }}
        >
            {containerSize.width > 0 && containerSize.height > 0 && (
                <>
                    {activeTab === "preview" && previewLoading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={theme.primary} />
                            <Text style={styles.loadingText}>Loading preview…</Text>
                        </View>
                    ) : activeTab === "preview" && previewEmpty ? (
                        <View style={styles.center}>
                            <Text style={styles.emptyTitle}>No playlist yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Generate a playlist on the Generate tab to preview it here.
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            key={activeTab}
                            data={activeItems}
                            keyExtractor={(item) => item.track.id}
                            renderItem={({ item, index }) => (
                                <VideoCard
                                    item={item}
                                    isActive={index === currentIndex && screenFocused}
                                    isNear={Math.abs(index - currentIndex) <= 2}
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
                            onEndReached={activeTab === "findMusic" ? loadMore : undefined}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={
                                activeTab === "findMusic" && loadingMore ? (
                                    <View style={[styles.center, { width: containerSize.width, height: containerSize.height }]}>
                                        <ActivityIndicator size="large" color={theme.primary} />
                                        <Text style={styles.loadingText}>Loading more…</Text>
                                    </View>
                                ) : null
                            }
                        />
                    )}

                    {/* Tab bar overlaid at top */}
                    <View style={styles.tabBar} pointerEvents="box-none">
                        <Pressable
                            style={styles.tabItem}
                            onPress={() => handleTabChange("findMusic")}
                        >
                            <Text style={[styles.tabLabel, activeTab === "findMusic" && styles.tabLabelActive]}>
                                Find Music
                            </Text>
                            {activeTab === "findMusic" && <View style={styles.tabUnderline} />}
                        </Pressable>
                        <Pressable
                            style={styles.tabItem}
                            onPress={() => handleTabChange("preview")}
                        >
                            <Text style={[styles.tabLabel, activeTab === "preview" && styles.tabLabelActive]}>
                                Preview
                            </Text>
                            {activeTab === "preview" && <View style={styles.tabUnderline} />}
                        </Pressable>
                    </View>
                </>
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
    emptyTitle: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },
    emptySubtitle: {
        color: "rgba(255,255,255,0.55)",
        fontSize: 14,
        textAlign: "center",
        paddingHorizontal: 40,
        lineHeight: 20,
    },
    tabBar: {
        position: "absolute",
        top: 56,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        gap: 32,
        zIndex: 10,
    },
    tabItem: {
        alignItems: "center",
        paddingBottom: 6,
    },
    tabLabel: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: 0.2,
    },
    tabLabelActive: {
        color: "#fff",
    },
    tabUnderline: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: "#fff",
        borderRadius: 1,
    },
});
