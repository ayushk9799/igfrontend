# Project specific ProGuard / R8 rules

# -------------------------------------------------------------------------
# App Code & Custom Widgets
# -------------------------------------------------------------------------
-keep class com.thousandways.love.** { *; }
-keepclassmembers class com.thousandways.love.** { *; }

# -------------------------------------------------------------------------
# React Native Core
# -------------------------------------------------------------------------
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.module.annotations.** { *; }
-keepclassmembers class * implements com.facebook.react.bridge.JavaScriptModule {
    public *;
}
-keepclassmembers class * implements com.facebook.react.bridge.NativeModule {
    public *;
}
-keepclassmembers,includedescriptorclasses class * {
    native <methods>;
}
-dontwarn com.facebook.react.**

# Hermes / JNI
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# -------------------------------------------------------------------------
# Expo Modules
# -------------------------------------------------------------------------
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# -------------------------------------------------------------------------
# Third-Party Libraries
# -------------------------------------------------------------------------
# Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keepclassmembers class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# MMKV
-keep class com.tencent.mmkv.** { *; }
-dontwarn com.tencent.mmkv.**

# WebRTC
-keep class org.webrtc.** { *; }
-keepclassmembers class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Purchases & Play Billing
-keep class com.revenuecat.purchases.** { *; }
-keep class com.android.billingclient.** { *; }
-dontwarn com.revenuecat.purchases.**

# WorkManager
-keep class androidx.work.** { *; }
-keep class * extends androidx.work.Worker { *; }
-keep class * extends androidx.work.ListenableWorker { *; }

# Notifee
-keep class app.notifee.** { *; }
-dontwarn app.notifee.**

# Lottie
-keep class com.airbnb.lottie.** { *; }

# BootSplash
-keep class com.zoontek.rnbootsplash.** { *; }

# In-App Updates
-keep class com.sudoplz.rninappupdates.** { *; }

# Hot Updater
-keep class com.hotupdater.** { *; }
