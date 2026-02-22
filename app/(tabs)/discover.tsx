import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Image,
    ViewToken,
} from "react-native";
import { WebView } from "react-native-webview";
import { useAuth } from "@/lib/AuthContext";
import { getTopTracks, SpotifyTrack } from "@/lib/spotify";
import { findMusicVideo, YouTubeMatch } from "@/lib/youtube";
import { theme } from "@/constants/Colors";

// ---- FIX FOR 153: stable HTTPS origin even in dev ----
// This does NOT need to resolve. It just needs to be a consistent https origin string.
const WEB_ORIGIN = __DEV__ ? "https://app.local" : "https://yourdomain.com";

function buildYouTubeHtml(videoId: string, origin: string): string {
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

    function onYouTubeIframeAPIReady(){
      player=new YT.Player('p',{
        width:'100%',
        height:'100%',
        videoId:'${videoId}',
        playerVars:{
          autoplay:1,
          mute:1,
          playsinline:1,
          controls:0,
          rel:0,
          modestbranding:1,
          enablejsapi:1,
          origin:'${origin}'
        },
        events:{
          onReady:function(e){
            // IMPORTANT: do NOT force iframe.referrerPolicy here.
            // That can contribute to missing referrer / error 153.
            try { e.target.playVideo(); } catch(err) {}
          },
          onStateChange:function(e){
            // Keep your existing behavior; not required for 153.
            if(e.data===1){
              try { player.unMute(); player.setVolume(100); } catch(err) {}
            }
          }
        }
      });
    }

    function handle(msg){
      if(!player) return;
      // RN Android uses document message, iOS uses window message
      var data = msg && msg.data ? msg.data : msg;
      if(data==='play') player.playVideo();
      if(data==='pause') player.pauseVideo();
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

const VideoCard = React.memo(
    ({
         item,
         isActive,
         width,
         height,
     }: {
        item: FeedItem;
        isActive: boolean;
        width: number;
        height: number;
    }) => {
        const albumArt = item.track.album.images[0]?.url;
        const artist = item.track.artists[0]?.name ?? "";
        const showVideo = item.match != null;

        // Cover-fill: scale 16:9 video to fill full screen height, crop sides
        const playerH = height;
        const playerW = Math.ceil(height * (16 / 9));
        const offsetX = -Math.floor((playerW - width) / 2);

        const webViewRef = useRef<WebView>(null);
        const wasActive = useRef(false);

        useEffect(() => {
            if (!webViewRef.current || !item.match) return;
            if (isActive && !wasActive.current) {
                webViewRef.current.injectJavaScript("player&&player.playVideo();true;");
            } else if (!isActive && wasActive.current) {
                webViewRef.current.injectJavaScript("player&&player.pauseVideo();true;");
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
                                top: 0,
                                width: playerW,
                                height: playerH,
                            }}
                        >
                            <WebView
                                ref={webViewRef}
                                // ---- FIX FOR 153: provide baseUrl + origin ----
                                source={{
                                    html: buildYouTubeHtml(item.match!.videoId, WEB_ORIGIN),
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
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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