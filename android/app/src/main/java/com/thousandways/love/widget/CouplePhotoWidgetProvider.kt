package com.thousandways.love.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.thousandways.love.MainActivity
import com.thousandways.love.R
import java.io.File

class CouplePhotoWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(context, manager, it) }
        try {
            WidgetStatusReporter.report(context)
        } catch (_: Exception) {}
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        try {
            WidgetStatusReporter.report(context)
        } catch (_: Exception) {}
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        try {
            WidgetStatusReporter.report(context)
        } catch (_: Exception) {}
    }

    private fun decodeSampledBitmap(file: File, reqWidth: Int, reqHeight: Int): Bitmap? {
        if (!file.exists()) return null
        return try {
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeFile(file.absolutePath, options)
            if (options.outWidth <= 0 || options.outHeight <= 0) return null

            var inSampleSize = 1
            val halfHeight = options.outHeight / 2
            val halfWidth = options.outWidth / 2
            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply {
                this.inSampleSize = inSampleSize
            }
            BitmapFactory.decodeFile(file.absolutePath, decodeOptions)
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to decode bitmap from ${file.name}", e)
            null
        }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
        try {
            val views = RemoteViews(context.packageName, R.layout.couple_photo_widget_layout)
            val prefs = context.getSharedPreferences(ScribbleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
            val imageFile = File(context.filesDir, PHOTO_FILE_NAME)
            val bitmap = decodeSampledBitmap(imageFile, 600, 600)
            val myImageFile = File(context.filesDir, MY_PHOTO_FILE_NAME)
            val myBitmap = decodeSampledBitmap(myImageFile, 150, 150)

            if (bitmap != null) {
                views.setImageViewBitmap(R.id.couple_photo_image, bitmap)
                views.setViewVisibility(R.id.couple_photo_image, View.VISIBLE)
                views.setViewVisibility(R.id.couple_photo_empty, View.GONE)
                val defaultSender = context.getString(R.string.widget_your_partner)
                val senderName = prefs.getString(KEY_SENDER_NAME, defaultSender) ?: defaultSender
                val senderText = try {
                    context.getString(R.string.widget_from_partner, senderName)
                } catch (_: Exception) {
                    "From $senderName"
                }
                views.setTextViewText(R.id.couple_photo_sender, senderText)
                views.setViewVisibility(R.id.couple_photo_sender, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.couple_photo_image, View.GONE)
                views.setViewVisibility(R.id.couple_photo_sender, View.GONE)
                views.setViewVisibility(R.id.couple_photo_empty, View.VISIBLE)
            }

            if (myBitmap != null) {
                views.setImageViewBitmap(R.id.couple_photo_my_image, myBitmap)
                views.setViewVisibility(R.id.couple_photo_my_image, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.couple_photo_my_image, View.GONE)
            }

            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            views.setOnClickPendingIntent(R.id.couple_photo_container, pendingIntent)
            manager.updateAppWidget(id, views)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update couple photo widget $id", e)
        }
    }

    companion object {
        private const val TAG = "CouplePhotoWidget"
        const val PHOTO_FILE_NAME = "partner_photo.jpg"
        const val MY_PHOTO_FILE_NAME = "my_photo.jpg"
        const val KEY_SENDER_NAME = "couple_photo_sender_name"
        const val KEY_REVISION = "couple_photo_revision"
        const val KEY_MY_REVISION = "couple_photo_my_revision"
    }
}
