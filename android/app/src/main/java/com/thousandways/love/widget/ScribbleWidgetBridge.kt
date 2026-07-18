package com.thousandways.love.widget

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.google.android.gms.location.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URL

/**
 * ScribbleWidgetBridge - React Native native module for Android widget
 * Mirrors iOS ScribbleWidgetBridge.swift functionality
 */
class ScribbleWidgetBridge(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ScribbleWidgetBridge"

    /**
     * Save scribble paths to SharedPreferences for widget access
     */
    @ReactMethod
    fun saveScribblePaths(pathsArray: ReadableArray, metadata: ReadableMap, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                ScribbleWidgetProvider.PREFS_NAME, 
                Context.MODE_PRIVATE
            )
            
            // Convert ReadableArray to JSON string
            val jsonArray = JSONArray()
            for (i in 0 until pathsArray.size()) {
                val pathMap = pathsArray.getMap(i)
                val jsonObj = org.json.JSONObject()
                jsonObj.put("d", pathMap?.getString("d") ?: "")
                jsonObj.put("color", pathMap?.getString("color") ?: "#FFFFFF")
                jsonObj.put("strokeWidth", pathMap?.getDouble("strokeWidth") ?: 3.0)
                jsonArray.put(jsonObj)
            }
            
            val senderName = metadata.getString("senderName") ?: "Your Love"
            val canvasWidth = if (metadata.hasKey("canvasWidth")) metadata.getDouble("canvasWidth") else 350.0
            val canvasHeight = if (metadata.hasKey("canvasHeight")) metadata.getDouble("canvasHeight") else canvasWidth
            
            prefs.edit().apply {
                putString(ScribbleWidgetProvider.KEY_SCRIBBLE_PATHS, jsonArray.toString())
                putString(ScribbleWidgetProvider.KEY_SENDER_NAME, senderName)
                putFloat(ScribbleWidgetProvider.KEY_CANVAS_WIDTH, canvasWidth.toFloat())
                putFloat(ScribbleWidgetProvider.KEY_CANVAS_HEIGHT, canvasHeight.toFloat())
                apply()
            }
            
            refreshScribbleWidgetInternal()
            
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to save scribble: ${e.message}", e)
        }
    }

    /**
     * Trigger widget refresh
     */
    @ReactMethod
    fun refreshWidget(promise: Promise) {
        try {
            refreshAllWidgetsInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to refresh widget: ${e.message}", e)
        }
    }

    private fun refreshScribbleWidgetInternal() {
        val appWidgetManager = AppWidgetManager.getInstance(reactContext)
        val componentName = ComponentName(reactContext, ScribbleWidgetProvider::class.java)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
        
        if (appWidgetIds.isNotEmpty()) {
            val intent = Intent(reactContext, ScribbleWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
            }
            reactContext.sendBroadcast(intent)
        }
    }

    private fun refreshProvider(providerClass: Class<*>) {
        val appWidgetManager = AppWidgetManager.getInstance(reactContext)
        val componentName = ComponentName(reactContext, providerClass)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

        if (appWidgetIds.isNotEmpty()) {
            val intent = Intent(reactContext, providerClass).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
            }
            reactContext.sendBroadcast(intent)
        }
    }

    private fun refreshRelationshipWidgetsInternal() {
        refreshProvider(TogetherDaysWidgetProvider::class.java)
        refreshProvider(TogetherCountdownWidgetProvider::class.java)
        refreshProvider(DistanceWidgetProvider::class.java)
    }

    private fun refreshAllWidgetsInternal() {
        refreshScribbleWidgetInternal()
        refreshRelationshipWidgetsInternal()
        refreshProvider(CouplePhotoWidgetProvider::class.java)
    }

    @ReactMethod
    fun savePartnerPhoto(imageUrl: String, metadata: ReadableMap, promise: Promise) {
        saveCouplePhoto(imageUrl, metadata, CouplePhotoWidgetProvider.PHOTO_FILE_NAME, CouplePhotoWidgetProvider.KEY_REVISION, promise)
    }

    @ReactMethod
    fun saveMyPhoto(imageUrl: String, metadata: ReadableMap, promise: Promise) {
        saveCouplePhoto(imageUrl, metadata, CouplePhotoWidgetProvider.MY_PHOTO_FILE_NAME, CouplePhotoWidgetProvider.KEY_MY_REVISION, promise)
    }

    private fun saveCouplePhoto(imageUrl: String, metadata: ReadableMap, fileName: String, revisionKey: String, promise: Promise) {
        Thread {
            try {
                val revision = if (metadata.hasKey("revision")) metadata.getDouble("revision").toLong() else System.currentTimeMillis()
                val prefs = reactContext.getSharedPreferences(ScribbleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                val existingRevision = prefs.getLong(revisionKey, 0L)
                if (revision < existingRevision) {
                    promise.resolve(true)
                    return@Thread
                }

                val connection = URL(imageUrl).openConnection().apply {
                    connectTimeout = 15000
                    readTimeout = 20000
                    useCaches = false
                }
                connection.getInputStream().use { input ->
                    File(reactContext.filesDir, fileName).outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
                prefs.edit()
                    .putLong(revisionKey, revision)
                    .apply()
                if (fileName == CouplePhotoWidgetProvider.PHOTO_FILE_NAME) {
                    prefs.edit()
                        .putString(CouplePhotoWidgetProvider.KEY_SENDER_NAME, metadata.getString("senderName") ?: "Your partner")
                        .apply()
                }
                refreshProvider(CouplePhotoWidgetProvider::class.java)
                promise.resolve(true)
            } catch (error: Exception) {
                promise.reject("ERROR", "Failed to cache partner photo: ${error.message}", error)
            }
        }.start()
    }

    @ReactMethod
    fun clearPartnerPhoto(promise: Promise) {
        clearCouplePhoto(CouplePhotoWidgetProvider.PHOTO_FILE_NAME, CouplePhotoWidgetProvider.KEY_REVISION, true, promise)
    }

    @ReactMethod
    fun clearMyPhoto(promise: Promise) {
        clearCouplePhoto(CouplePhotoWidgetProvider.MY_PHOTO_FILE_NAME, CouplePhotoWidgetProvider.KEY_MY_REVISION, false, promise)
    }

    private fun clearCouplePhoto(fileName: String, revisionKey: String, clearSender: Boolean, promise: Promise) {
        try {
            File(reactContext.filesDir, fileName).delete()
            val editor = reactContext.getSharedPreferences(ScribbleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove(revisionKey)
            if (clearSender) editor.remove(CouplePhotoWidgetProvider.KEY_SENDER_NAME)
            editor.apply()
            refreshProvider(CouplePhotoWidgetProvider::class.java)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("ERROR", "Failed to clear couple photo: ${error.message}", error)
        }
    }

    @ReactMethod
    fun saveTogetherStartDate(startDate: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                ScribbleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )

            prefs.edit()
                .putString(RelationshipWidgetRenderer.KEY_TOGETHER_START_DATE, startDate)
                .apply()

            refreshProvider(TogetherDaysWidgetProvider::class.java)
            refreshProvider(TogetherCountdownWidgetProvider::class.java)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to save together date: ${e.message}", e)
        }
    }

    @ReactMethod
    fun clearTogetherStartDate(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                ScribbleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )

            prefs.edit()
                .remove(RelationshipWidgetRenderer.KEY_TOGETHER_START_DATE)
                .apply()

            refreshProvider(TogetherDaysWidgetProvider::class.java)
            refreshProvider(TogetherCountdownWidgetProvider::class.java)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to clear together date: ${e.message}", e)
        }
    }

    @ReactMethod
    fun saveDistanceWidgetData(distanceData: ReadableMap, promise: Promise) {
        try {
            val json = JSONObject()
            val iterator = distanceData.keySetIterator()
            while (iterator.hasNextKey()) {
                val key = iterator.nextKey()
                when (distanceData.getType(key)) {
                    ReadableType.Null -> json.put(key, JSONObject.NULL)
                    ReadableType.Boolean -> json.put(key, distanceData.getBoolean(key))
                    ReadableType.Number -> json.put(key, distanceData.getDouble(key))
                    ReadableType.String -> json.put(key, distanceData.getString(key))
                    else -> Unit
                }
            }

            val prefs = reactContext.getSharedPreferences(
                ScribbleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )

            prefs.edit()
                .putString(RelationshipWidgetRenderer.KEY_DISTANCE_DATA, json.toString())
                .apply()

            refreshProvider(DistanceWidgetProvider::class.java)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to save distance widget data: ${e.message}", e)
        }
    }

    @ReactMethod
    fun clearDistanceWidgetData(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                ScribbleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )

            prefs.edit()
                .remove(RelationshipWidgetRenderer.KEY_DISTANCE_DATA)
                .apply()

            refreshProvider(DistanceWidgetProvider::class.java)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to clear distance widget data: ${e.message}", e)
        }
    }

    @ReactMethod
    fun setWidgetTrackingContext(userId: String, apiBase: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(
                ScribbleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )

            prefs.edit()
                .putString(WidgetStatusReporter.KEY_TRACKING_USER_ID, userId)
                .putString(WidgetStatusReporter.KEY_TRACKING_API_BASE, apiBase)
                .apply()

            WidgetStatusReporter.report(reactContext, "native")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set widget tracking context: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getWidgetConfigurations(promise: Promise) {
        try {
            val result = Arguments.createMap()
            WidgetStatusReporter.collect(reactContext).forEach { (type, count) ->
                val status = Arguments.createMap().apply {
                    putBoolean("installed", count > 0)
                    putInt("activeCount", count)
                }
                result.putMap(type, status)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to read widget configurations: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startDistanceBackgroundUpdates(promise: Promise) {
        try {
            DistanceWidgetSyncWorker.schedule(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to start distance background updates: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopDistanceBackgroundUpdates(promise: Promise) {
        try {
            DistanceWidgetSyncWorker.cancel(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to stop distance background updates: ${e.message}", e)
        }
    }

    /**
     * Request current device location using FusedLocationProviderClient.
     * Mirrors iOS ScribbleWidgetBridge.requestCurrentLocation behavior.
     * Returns a map with { latitude, longitude, accuracy, timestamp }.
     */
    @ReactMethod
    fun requestCurrentLocation(promise: Promise) {
        // Check if location permissions are granted
        val hasFine = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasCoarse = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasFine && !hasCoarse) {
            promise.reject(
                "LOCATION_DENIED",
                "Location permission is not granted. Please enable location access in Settings."
            )
            return
        }

        try {
            val fusedClient = LocationServices.getFusedLocationProviderClient(reactContext)

            // First try getLastLocation for a quick cached result
            fusedClient.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) {
                        val result = Arguments.createMap().apply {
                            putDouble("latitude", location.latitude)
                            putDouble("longitude", location.longitude)
                            putDouble("accuracy", location.accuracy.toDouble())
                            putString("timestamp", java.text.SimpleDateFormat(
                                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                                java.util.Locale.US
                            ).apply {
                                timeZone = java.util.TimeZone.getTimeZone("UTC")
                            }.format(java.util.Date(location.time)))
                        }
                        promise.resolve(result)
                    } else {
                        // No cached location — request a fresh one
                        requestFreshLocation(fusedClient, promise)
                    }
                }
                .addOnFailureListener { e ->
                    // lastLocation failed — fall back to a fresh request
                    requestFreshLocation(fusedClient, promise)
                }
        } catch (e: Exception) {
            promise.reject("LOCATION_ERROR", "Failed to initialize location client: ${e.message}", e)
        }
    }

    /**
     * Request a fresh location fix using a one-shot location request.
     * Called when getLastLocation() returns null (common when GPS hasn't been used recently).
     */
    private fun requestFreshLocation(fusedClient: FusedLocationProviderClient, promise: Promise) {
        try {
            val locationRequest = LocationRequest.Builder(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                1000L // interval (irrelevant for single request, but required)
            )
                .setMaxUpdates(1)
                .setDurationMillis(15000L) // 15 second timeout
                .build()

            val callback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    fusedClient.removeLocationUpdates(this)
                    val location = result.lastLocation
                    if (location != null) {
                        val map = Arguments.createMap().apply {
                            putDouble("latitude", location.latitude)
                            putDouble("longitude", location.longitude)
                            putDouble("accuracy", location.accuracy.toDouble())
                            putString("timestamp", java.text.SimpleDateFormat(
                                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                                java.util.Locale.US
                            ).apply {
                                timeZone = java.util.TimeZone.getTimeZone("UTC")
                            }.format(java.util.Date(location.time)))
                        }
                        promise.resolve(map)
                    } else {
                        promise.reject(
                            "LOCATION_UNAVAILABLE",
                            "Current location is unavailable. Please try again."
                        )
                    }
                }
            }

            fusedClient.requestLocationUpdates(
                locationRequest,
                callback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            promise.reject("LOCATION_DENIED", "Location permission was revoked: ${e.message}", e)
        } catch (e: Exception) {
            promise.reject("LOCATION_ERROR", "Failed to request location: ${e.message}", e)
        }
    }

    /**
     * Check if widget is available (Android 4.0+, always true for modern apps)
     */
    @ReactMethod
    fun isWidgetAvailable(promise: Promise) {
        promise.resolve(true)
    }

    /**
     * Save scribble image (legacy method for compatibility)
     */
    @ReactMethod
    fun saveScribbleImage(imagePath: String, metadata: ReadableMap, promise: Promise) {
        // For Android, we primarily use path-based rendering
        // This method exists for API compatibility with iOS
        promise.resolve(true)
    }
}
