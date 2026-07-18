package com.thousandways.love.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.view.View
import android.widget.RemoteViews
import com.thousandways.love.MainActivity
import com.thousandways.love.R
import java.io.File

class CouplePhotoWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateWidget(context, manager, it) }
        WidgetStatusReporter.report(context)
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetStatusReporter.report(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        WidgetStatusReporter.report(context)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
        val views = RemoteViews(context.packageName, R.layout.couple_photo_widget_layout)
        val prefs = context.getSharedPreferences(ScribbleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val imageFile = File(context.filesDir, PHOTO_FILE_NAME)
        val bitmap = if (imageFile.exists()) BitmapFactory.decodeFile(imageFile.absolutePath) else null

        if (bitmap != null) {
            views.setImageViewBitmap(R.id.couple_photo_image, bitmap)
            views.setViewVisibility(R.id.couple_photo_image, View.VISIBLE)
            views.setViewVisibility(R.id.couple_photo_empty, View.GONE)
            views.setTextViewText(R.id.couple_photo_sender, "From ${prefs.getString(KEY_SENDER_NAME, "Your partner")}")
            views.setViewVisibility(R.id.couple_photo_sender, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.couple_photo_image, View.GONE)
            views.setViewVisibility(R.id.couple_photo_sender, View.GONE)
            views.setViewVisibility(R.id.couple_photo_empty, View.VISIBLE)
        }

        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        views.setOnClickPendingIntent(R.id.couple_photo_container, pendingIntent)
        manager.updateAppWidget(id, views)
    }

    companion object {
        const val PHOTO_FILE_NAME = "partner_photo.jpg"
        const val KEY_SENDER_NAME = "couple_photo_sender_name"
        const val KEY_REVISION = "couple_photo_revision"
    }
}
