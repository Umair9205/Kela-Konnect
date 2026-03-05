# react-native-webrtc
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Keep our native modules
-keep class com.anonymous.kelakonnect.WifiDirectModule { *; }
-keep class com.anonymous.kelakonnect.AudioStreamModule { *; }