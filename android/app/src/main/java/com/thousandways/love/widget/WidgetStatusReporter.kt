package com.thousandways.love.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

object WidgetStatusReporter {
    const val KEY_TRACKING_USER_ID = "widget_tracking_user_id"
    const val KEY_TRACKING_API_BASE = "widget_tracking_api_base"

    private val providerTypes = listOf(
        "scribble" to ScribbleWidgetProvider::class.java,
        "togetherDays" to TogetherDaysWidgetProvider::class.java,
        "togetherCountdown" to TogetherCountdownWidgetProvider::class.java,
        "distance" to DistanceWidgetProvider::class.java
    )

    fun collect(context: Context): Map<String, Int> {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        return providerTypes.associate { (type, providerClass) ->
            val count = appWidgetManager.getAppWidgetIds(ComponentName(context, providerClass)).size
            type to count
        }
    }

    fun report(context: Context, source: String = "native") {
        val prefs = context.getSharedPreferences(ScribbleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val userId = prefs.getString(KEY_TRACKING_USER_ID, null) ?: return
        val apiBase = prefs.getString(KEY_TRACKING_API_BASE, null)?.trimEnd('/') ?: return
        val counts = collect(context)

        Thread {
            try {
                val widgets = JSONObject()
                counts.forEach { (type, count) ->
                    widgets.put(type, JSONObject().apply {
                        put("installed", count > 0)
                        put("activeCount", count)
                    })
                }

                val payload = JSONObject().apply {
                    put("userId", userId)
                    put("platform", "android")
                    put("source", source)
                    put("widgets", widgets)
                }

                val connection = (URL("$apiBase/api/user/widgets/status").openConnection() as HttpURLConnection).apply {
                    requestMethod = "PUT"
                    connectTimeout = 5000
                    readTimeout = 5000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }

                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(payload.toString())
                }

                connection.inputStream.close()
                connection.disconnect()
            } catch (_: Exception) {
                // Widget metrics are best-effort and must not affect widget rendering.
            }
        }.start()
    }
}
