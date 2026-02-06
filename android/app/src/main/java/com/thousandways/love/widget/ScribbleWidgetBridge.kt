package com.thousandways.love.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*
import org.json.JSONArray

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
            
            prefs.edit().apply {
                putString(ScribbleWidgetProvider.KEY_SCRIBBLE_PATHS, jsonArray.toString())
                putString(ScribbleWidgetProvider.KEY_SENDER_NAME, senderName)
                apply()
            }
            
            // Trigger widget refresh
            refreshWidgetInternal()
            
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
            refreshWidgetInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to refresh widget: ${e.message}", e)
        }
    }

    private fun refreshWidgetInternal() {
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
