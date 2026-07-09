package com.thousandways.love.widget

import android.Manifest
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.google.android.gms.location.LocationServices
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class DistanceWidgetSyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : Worker(context, workerParams) {

    override fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences(
            ScribbleWidgetProvider.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        val userId = prefs.getString(WidgetStatusReporter.KEY_TRACKING_USER_ID, null) ?: return Result.success()
        val apiBase = prefs.getString(WidgetStatusReporter.KEY_TRACKING_API_BASE, null)?.trimEnd('/') ?: return Result.success()

        if (!hasLocationPermission()) {
            return Result.success()
        }

        val location = getLastKnownLocation() ?: return Result.retry()

        return try {
            putLocation(apiBase, userId, location.latitude, location.longitude)
            val distancePayload = getDistance(apiBase, userId)
            prefs.edit()
                .putString(RelationshipWidgetRenderer.KEY_DISTANCE_DATA, distancePayload.toString())
                .apply()
            refreshDistanceWidget()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            applicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            applicationContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun getLastKnownLocation(): android.location.Location? {
        var location: android.location.Location? = null
        val latch = CountDownLatch(1)
        val client = LocationServices.getFusedLocationProviderClient(applicationContext)

        try {
            client.lastLocation
                .addOnSuccessListener {
                    location = it
                    latch.countDown()
                }
                .addOnFailureListener {
                    latch.countDown()
                }
            latch.await(12, TimeUnit.SECONDS)
        } catch (_: Exception) {
            return null
        }

        return location
    }

    private fun putLocation(apiBase: String, userId: String, latitude: Double, longitude: Double) {
        val payload = JSONObject().apply {
            put("userId", userId)
            put("latitude", latitude)
            put("longitude", longitude)
            put("sharingEnabled", true)
        }

        val connection = openJsonConnection("$apiBase/api/user/location", "PUT")
        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(payload.toString())
        }
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException("Location update failed")
        }
        connection.inputStream.close()
        connection.disconnect()
    }

    private fun getDistance(apiBase: String, userId: String): JSONObject {
        val connection = openJsonConnection("$apiBase/api/user/distance/$userId", "GET")
        val text = connection.inputStream.bufferedReader().use { it.readText() }
        connection.disconnect()
        val response = JSONObject(text)
        if (!response.optBoolean("success", false)) {
            throw IllegalStateException("Distance lookup failed")
        }
        val data = response.optJSONObject("data") ?: JSONObject()
        data.put("locked", false)
        data.put("isPremium", true)
        data.put("updatedAt", isoNow())
        return data
    }

    private fun isoNow(): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

    private fun openJsonConnection(url: String, method: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10000
            readTimeout = 10000
            setRequestProperty("Content-Type", "application/json")
            if (method != "GET") {
                doOutput = true
            }
        }

    private fun refreshDistanceWidget() {
        val appWidgetManager = AppWidgetManager.getInstance(applicationContext)
        val componentName = ComponentName(applicationContext, DistanceWidgetProvider::class.java)
        val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
        if (appWidgetIds.isEmpty()) return

        val intent = Intent(applicationContext, DistanceWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
        }
        applicationContext.sendBroadcast(intent)
    }

    companion object {
        private const val WORK_NAME = "distance_widget_background_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<DistanceWidgetSyncWorker>(30, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
