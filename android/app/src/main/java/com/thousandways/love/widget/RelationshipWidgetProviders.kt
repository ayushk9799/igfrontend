package com.thousandways.love.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.os.Bundle
import android.os.SystemClock
import android.widget.RemoteViews
import com.thousandways.love.R
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

class TogetherDaysWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        RelationshipWidgetRenderer.update(
            context = context,
            appWidgetManager = appWidgetManager,
            appWidgetId = appWidgetId,
            type = RelationshipWidgetRenderer.WidgetType.DAYS
        )
    }
}

class TogetherCountdownWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val ACTION_AUTO_UPDATE = "com.thousandways.love.ACTION_COUNTDOWN_UPDATE"
        private const val UPDATE_INTERVAL_MS = 60_000L // 60 seconds
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
        scheduleNextUpdate(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_AUTO_UPDATE) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, TogetherCountdownWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds.isNotEmpty()) {
                appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
                scheduleNextUpdate(context)
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        cancelUpdate(context)
    }

    private fun scheduleNextUpdate(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, TogetherCountdownWidgetProvider::class.java).apply {
            action = ACTION_AUTO_UPDATE
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.set(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + UPDATE_INTERVAL_MS,
            pendingIntent
        )
    }

    private fun cancelUpdate(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, TogetherCountdownWidgetProvider::class.java).apply {
            action = ACTION_AUTO_UPDATE
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        RelationshipWidgetRenderer.update(
            context = context,
            appWidgetManager = appWidgetManager,
            appWidgetId = appWidgetId,
            type = RelationshipWidgetRenderer.WidgetType.COUNTDOWN
        )
    }
}

class DistanceWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        RelationshipWidgetRenderer.update(
            context = context,
            appWidgetManager = appWidgetManager,
            appWidgetId = appWidgetId,
            type = RelationshipWidgetRenderer.WidgetType.DISTANCE
        )
    }
}

object RelationshipWidgetRenderer {
    const val KEY_TOGETHER_START_DATE = "together_start_date"
    const val KEY_DISTANCE_DATA = "distance_widget_data"

    enum class WidgetType {
        DAYS,
        COUNTDOWN,
        DISTANCE
    }

    fun update(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        type: WidgetType
    ) {
        val views = RemoteViews(context.packageName, R.layout.relationship_widget_layout)
        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val density = context.resources.displayMetrics.density
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 140)
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        val widthPx = (minWidth * density).toInt().coerceAtLeast(220)
        val heightPx = (minHeight * density).toInt().coerceAtLeast(160)

        val prefs = context.getSharedPreferences(ScribbleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val bitmap = when (type) {
            WidgetType.DAYS -> renderDaysWidget(widthPx, heightPx, loadStartTime(prefs.getString(KEY_TOGETHER_START_DATE, null)))
            WidgetType.COUNTDOWN -> renderCountdownWidget(widthPx, heightPx, loadStartTime(prefs.getString(KEY_TOGETHER_START_DATE, null)))
            WidgetType.DISTANCE -> renderDistanceWidget(widthPx, heightPx, prefs.getString(KEY_DISTANCE_DATA, null))
        }

        views.setImageViewBitmap(R.id.relationship_widget_image, bitmap)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun renderDaysWidget(width: Int, height: Int, startTime: Long?): Bitmap {
        val bitmap = createBitmap(width, height)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

        val days = startTime?.let { max(0L, (System.currentTimeMillis() - it) / 86_400_000L) }
        val centerX = width / 2f
        val circleRadius = min(width, height) * 0.36f
        val centerY = height / 2f

        drawGlassCircle(canvas, centerX, centerY, circleRadius)
        drawHeart(canvas, centerX, centerY - circleRadius * 0.35f, circleRadius * 0.32f, Color.WHITE)

        if (days == null) {
            drawText(canvas, "Set date", centerX, centerY + circleRadius * 0.28f, width * 0.1f, Color.WHITE, Paint.Align.CENTER, true)
        } else {
            drawText(canvas, days.toString(), centerX, centerY + circleRadius * 0.22f, width * 0.16f, Color.WHITE, Paint.Align.CENTER, true)
            drawText(canvas, "days", centerX, centerY + circleRadius * 0.62f, width * 0.08f, Color.argb(225, 255, 255, 255), Paint.Align.CENTER, false)
        }

        return bitmap
    }

    private fun renderCountdownWidget(width: Int, height: Int, startTime: Long?): Bitmap {
        val bitmap = createBitmap(width, height)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

        val rect = accessoryRect(width, height)
        drawGlassRoundRect(canvas, rect, rect.height() * 0.28f)

        if (startTime == null) {
            drawText(canvas, "Set anniversary", rect.centerX(), rect.centerY() + height * 0.025f, height * 0.095f, Color.WHITE, Paint.Align.CENTER, true)
            return bitmap
        }

        val elapsed = max(0L, (System.currentTimeMillis() - startTime) / 1000L)
        val days = elapsed / 86_400L
        val hours = (elapsed % 86_400L) / 3_600L
        val minutes = (elapsed % 3_600L) / 60L
        val seconds = elapsed % 60L

        drawText(canvas, "together for", rect.centerX() - rect.width() * 0.08f, rect.top + rect.height() * 0.32f, rect.height() * 0.21f, Color.WHITE, Paint.Align.CENTER, true)
        drawHeart(canvas, rect.centerX() + rect.width() * 0.31f, rect.top + rect.height() * 0.26f, rect.height() * 0.065f, Color.WHITE)

        val labels = arrayOf("days", "hr", "min", "sec")
        val values = arrayOf(days.toString(), hours.twoDigits(), minutes.twoDigits(), seconds.twoDigits())
        val columns = values.size
        val usableWidth = rect.width() * 0.86f
        val startX = rect.left + (rect.width() - usableWidth) / 2f
        val columnWidth = usableWidth / columns

        values.forEachIndexed { index, value ->
            val x = startX + columnWidth * index + columnWidth / 2f
            drawText(canvas, value, x, rect.top + rect.height() * 0.68f, rect.height() * 0.27f, Color.WHITE, Paint.Align.CENTER, true)
            drawText(canvas, labels[index], x, rect.top + rect.height() * 0.88f, rect.height() * 0.14f, Color.argb(225, 255, 255, 255), Paint.Align.CENTER, false)
        }

        return bitmap
    }

    private fun renderDistanceWidget(width: Int, height: Int, distanceJson: String?): Bitmap {
        val bitmap = createBitmap(width, height)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

        val data = distanceJson?.let {
            runCatching { JSONObject(it) }.getOrNull()
        }
        val isLocked = data?.optBoolean("locked", false) == true
        val isTogether = data?.optBoolean("isTogether", false) == true
        val rawDistance = data?.optDouble("distanceKm", Double.NaN)
        val distanceKm = rawDistance?.takeUnless { it.isNaN() }
        val userInitial = data.initialFrom("userInitial", "userName")
        val partnerInitial = data.initialFrom("partnerInitial", "partnerName")
        val title = when {
            isTogether -> "We're together!"
            distanceKm == null -> "Share location"
            distanceKm >= 10 -> "Our distance: ${Math.round(distanceKm).toInt()} km"
            else -> "Our distance: ${String.format(Locale.US, "%.1f", distanceKm)} km"
        }

        val rect = accessoryRect(width, height)
        drawGlassRoundRect(canvas, rect, rect.height() * 0.28f)

        if (isLocked) {
            drawText(canvas, "Premium widget", rect.centerX(), rect.top + rect.height() * 0.42f, rect.height() * 0.2f, Color.WHITE, Paint.Align.CENTER, true)
            drawText(canvas, "Open app to unlock", rect.centerX(), rect.top + rect.height() * 0.66f, rect.height() * 0.14f, Color.argb(220, 255, 255, 255), Paint.Align.CENTER, false)
            return bitmap
        }

        drawText(canvas, title, rect.centerX(), rect.top + rect.height() * 0.34f, rect.height() * 0.2f, Color.WHITE, Paint.Align.CENTER, true)

        val rowLeft = rect.left + rect.width() * 0.12f
        val rowRight = rect.right - rect.width() * 0.12f
        val rowY = rect.top + rect.height() * 0.68f
        val closeness = distanceCloseness(distanceKm, isTogether)
        val minSeparation = rect.height() * 0.58f
        val maxSeparation = rowRight - rowLeft
        val separation = minSeparation + (maxSeparation - minSeparation) * (1f - closeness)
        val center = (rowLeft + rowRight) / 2f
        val leftX = center - separation / 2f
        val rightX = center + separation / 2f
        val avatarRadius = rect.height() * 0.2f

        if (!isTogether) {
            drawDashedLine(canvas, leftX + avatarRadius, rowY, rightX - avatarRadius, rowY)
        }
        drawDoubleHeart(canvas, center, rowY, rect.height() * 0.08f)
        drawInitial(canvas, leftX, rowY, avatarRadius, userInitial)
        drawInitial(canvas, rightX, rowY, avatarRadius, partnerInitial)

        return bitmap
    }

    private fun createBitmap(width: Int, height: Int): Bitmap =
        Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

    private fun drawGradient(canvas: Canvas, width: Int, height: Int, colors: IntArray) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, 0f, width.toFloat(), height.toFloat(), colors, null, Shader.TileMode.CLAMP)
        }
        canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), width * 0.08f, width * 0.08f, paint)

        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(36, 255, 255, 255)
            canvas.drawCircle(width * 0.05f, height * 0.1f, min(width, height) * 0.45f, this)
            canvas.drawCircle(width * 0.95f, height * 0.98f, min(width, height) * 0.42f, this)
        }
    }

    private fun accessoryRect(width: Int, height: Int): RectF {
        val rectWidth = width * 0.92f
        val rectHeight = height * 0.68f
        val left = (width - rectWidth) / 2f
        val top = (height - rectHeight) / 2f
        return RectF(left, top, left + rectWidth, top + rectHeight)
    }

    private fun drawGlassRoundRect(canvas: Canvas, rect: RectF, radius: Float) {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(92, 46, 30, 60)
            style = Paint.Style.FILL
            canvas.drawRoundRect(rect, radius, radius, this)

            color = Color.argb(62, 255, 255, 255)
            style = Paint.Style.STROKE
            strokeWidth = max(1.5f, rect.height() * 0.025f)
            canvas.drawRoundRect(rect, radius, radius, this)
        }
    }

    private fun drawText(
        canvas: Canvas,
        text: String,
        x: Float,
        baseline: Float,
        size: Float,
        color: Int,
        align: Paint.Align,
        bold: Boolean
    ) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            textSize = size
            textAlign = align
            typeface = Typeface.create(Typeface.DEFAULT, if (bold) Typeface.BOLD else Typeface.NORMAL)
        }
        canvas.drawText(text, x, baseline, paint)
    }

    private fun drawGlassCircle(canvas: Canvas, cx: Float, cy: Float, radius: Float) {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(74, 46, 30, 60)
            style = Paint.Style.FILL
            canvas.drawCircle(cx, cy, radius, this)

            color = Color.argb(78, 255, 255, 255)
            style = Paint.Style.STROKE
            strokeWidth = radius * 0.04f
            canvas.drawCircle(cx, cy, radius, this)
        }
    }

    private fun drawInitial(canvas: Canvas, cx: Float, cy: Float, radius: Float, initial: String) {
        drawGlassCircle(canvas, cx, cy, radius)
        drawText(canvas, initial, cx, cy + radius * 0.34f, radius * 0.95f, Color.WHITE, Paint.Align.CENTER, true)
    }

    private fun drawDashedLine(canvas: Canvas, startX: Float, startY: Float, endX: Float, endY: Float) {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(225, 255, 255, 255)
            strokeWidth = 4f
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            pathEffect = DashPathEffect(floatArrayOf(2f, 9f), 0f)
            canvas.drawLine(startX, startY, endX, endY, this)
        }
    }

    private fun drawHeart(canvas: Canvas, cx: Float, cy: Float, size: Float, color: Int) {
        val path = Path().apply {
            moveTo(cx, cy + size * 0.55f)
            cubicTo(cx - size * 1.35f, cy - size * 0.25f, cx - size * 0.75f, cy - size * 1.25f, cx, cy - size * 0.45f)
            cubicTo(cx + size * 0.75f, cy - size * 1.25f, cx + size * 1.35f, cy - size * 0.25f, cx, cy + size * 0.55f)
            close()
        }
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.FILL
            canvas.drawPath(path, this)
        }
    }

    private fun drawDoubleHeart(canvas: Canvas, cx: Float, cy: Float, size: Float) {
        drawHeart(canvas, cx + size * 0.7f, cy - size * 0.45f, size * 0.95f, Color.argb(236, 255, 255, 255))
        drawHeart(canvas, cx - size * 0.45f, cy + size * 0.18f, size * 1.08f, Color.WHITE)
    }

    private fun distanceCloseness(distanceKm: Double?, isTogether: Boolean): Float {
        if (isTogether || (distanceKm != null && distanceKm <= 0.1)) return 1f
        if (distanceKm == null) return 0f
        val closeKm = 0.1
        val farKm = 500.0
        val boundedDistance = min(max(distanceKm, closeKm), farKm)
        val raw = 1 - ((log10(boundedDistance) - log10(closeKm)) / (log10(farKm) - log10(closeKm)))
        return raw.pow(0.65).toFloat()
    }

    private fun loadStartTime(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX"
        )

        for (pattern in formats) {
            val formatter = SimpleDateFormat(pattern, Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val date = runCatching { formatter.parse(value) }.getOrNull()
            if (date != null) return date.time
        }
        return null
    }

    private fun Long.twoDigits(): String = String.format(Locale.US, "%02d", this)

    private fun String?.ifNullOrBlank(fallback: String): String =
        if (this.isNullOrBlank()) fallback else this

    private fun JSONObject?.initialFrom(initialKey: String, nameKey: String): String {
        val explicitInitial = this?.stringOrNull(initialKey)?.trim()
        val nameInitial = this?.stringOrNull(nameKey)?.trim()
        return (explicitInitial.ifNullOrBlank(nameInitial.ifNullOrBlank("?")))
            .take(1)
            .uppercase(Locale.US)
    }

    private fun JSONObject.stringOrNull(key: String): String? =
        if (has(key) && !isNull(key)) optString(key) else null
}
