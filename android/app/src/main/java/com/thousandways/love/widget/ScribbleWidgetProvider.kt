package com.thousandways.love.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.SharedPreferences
import android.graphics.*
import android.widget.RemoteViews
import com.thousandways.love.R
import org.json.JSONArray
import org.json.JSONObject

/**
 * ScribbleWidgetProvider - Android widget that displays partner's scribble drawings
 * Similar to iOS ScribbleWidget.swift implementation
 */
class ScribbleWidgetProvider : AppWidgetProvider() {

    companion object {
        const val PREFS_NAME = "ScribbleWidgetPrefs"
        const val KEY_SCRIBBLE_PATHS = "scribble_paths"
        const val KEY_SENDER_NAME = "sender_name"
        const val KEY_CANVAS_WIDTH = "scribble_canvas_width"
        const val KEY_CANVAS_HEIGHT = "scribble_canvas_height"
        private const val CANVAS_SIZE = 350f
        
        // Placeholder heart paths (matching iOS)
        private val PLACEHOLDER_HEART_PATHS = listOf(
            PathData("M159.3,109.0 L156.0,105.7 L150.7,101.7 L147.3,98.7 L144.0,96.0 L140.3,93.0 L136.0,90.7 L130.0,89.0 L122.7,88.7 L113.3,88.7 L103.3,93.0 L94.3,99.3 L86.7,107.0 L80.3,115.7 L75.7,124.0 L74.0,131.7 L73.7,138.7 L74.0,145.0 L78.0,151.0 L84.0,157.0 L91.0,162.7 L98.3,167.3 L107.0,171.3 L116.0,174.0 L124.0,176.7 L131.3,180.0 L138.7,184.0 L145.0,188.7 L151.3,194.3 L156.7,199.0 L161.3,203.3 L165.3,207.0 L168.3,210.7 L171.3,214.0 L174.7,218.0 L177.0,222.0 L179.3,226.3 L180.7,229.3 L181.3,231.0 L181.3,231.3", "#FF6B6B", 3f),
            PathData("M168.0,108.3 L167.0,96.0 L168.0,91.7 L171.0,85.3 L174.7,78.0 L179.7,70.7 L185.0,64.3 L191.3,58.7 L198.7,53.7 L206.7,49.7 L215.3,47.0 L223.3,45.3 L231.0,44.7 L238.0,44.7 L244.3,45.0 L249.0,48.3 L253.0,52.0 L256.7,56.7 L259.0,61.7 L260.0,67.0 L260.3,72.7 L260.3,78.0 L260.3,83.0 L260.3,88.7 L259.7,94.7 L257.3,100.0 L254.7,105.3 L252.0,111.0 L250.0,116.3 L247.3,121.3 L244.7,126.3 L241.7,131.3 L238.3,136.0 L234.7,141.3 L230.3,146.0 L226.0,150.3 L221.7,155.3 L217.3,160.3 L212.3,165.3 L207.3,170.3 L202.7,174.7 L198.3,179.3 L194.7,184.0 L191.3,189.0 L188.7,194.7 L186.7,200.3 L185.7,205.7 L185.0,210.7 L184.3,215.7 L184.3,220.0 L184.3,224.0 L184.3,227.3 L184.3,229.7 L184.3,231.3 L184.3,232.0 L184.0,232.0", "#F97068", 3f)
        )
    }

    data class PathData(val d: String, val color: String, val strokeWidth: Float)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.scribble_widget_layout)
        
        // Get widget dimensions
        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        
        // Convert dp to pixels
        val density = context.resources.displayMetrics.density
        val widthPx = (minWidth * density).toInt().coerceAtLeast(200)
        val heightPx = (minHeight * density).toInt().coerceAtLeast(200)
        
        // Load scribble data
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val pathsJson = prefs.getString(KEY_SCRIBBLE_PATHS, null)
        val sourceWidth = prefs.getFloat(KEY_CANVAS_WIDTH, CANVAS_SIZE).takeIf { it > 0f } ?: CANVAS_SIZE
        val sourceHeight = prefs.getFloat(KEY_CANVAS_HEIGHT, sourceWidth).takeIf { it > 0f } ?: sourceWidth
        
        // Render bitmap
        val bitmap = if (pathsJson.isNullOrEmpty()) {
            renderPaths(PLACEHOLDER_HEART_PATHS, widthPx, heightPx, CANVAS_SIZE, CANVAS_SIZE, 0.6f)
        } else {
            val paths = parsePathsFromJson(pathsJson)
            renderPaths(paths, widthPx, heightPx, sourceWidth, sourceHeight, 1f)
        }
        
        views.setImageViewBitmap(R.id.widget_scribble_image, bitmap)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    private fun parsePathsFromJson(jsonString: String): List<PathData> {
        val paths = mutableListOf<PathData>()
        try {
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val pathObj = jsonArray.getJSONObject(i)
                val d = pathObj.optString("d", "")
                val color = pathObj.optString("color", "#FFFFFF")
                val strokeWidth = pathObj.optDouble("strokeWidth", 3.0).toFloat()
                if (d.isNotEmpty()) {
                    paths.add(PathData(d, color, strokeWidth))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return paths
    }

    private fun renderPaths(
        pathDataList: List<PathData>,
        width: Int,
        height: Int,
        sourceWidth: Float,
        sourceHeight: Float,
        alpha: Float
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        
        // Fill with light background
        canvas.drawColor(Color.parseColor("#FAFAFA"))
        
        // Calculate scale to fit the content while maintaining aspect ratio
        val safeSourceWidth = if (sourceWidth > 0f) sourceWidth else CANVAS_SIZE
        val safeSourceHeight = if (sourceHeight > 0f) sourceHeight else safeSourceWidth
        val scale = minOf(width.toFloat() / safeSourceWidth, height.toFloat() / safeSourceHeight)
        
        // Calculate offset to center the drawing
        val offsetX = (width - (safeSourceWidth * scale)) / 2f
        val offsetY = (height - (safeSourceHeight * scale)) / 2f
        
        // Apply translation to center the paths
        canvas.save()
        canvas.translate(offsetX, offsetY)
        
        for (pathData in pathDataList) {
            val path = parseSvgPath(pathData.d, scale)
            val paint = Paint().apply {
                color = Color.parseColor(pathData.color)
                strokeWidth = pathData.strokeWidth * scale
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                isAntiAlias = true
                this.alpha = (alpha * 255).toInt()
            }
            canvas.drawPath(path, paint)
        }
        
        canvas.restore()
        
        return bitmap
    }

    private fun parseSvgPath(pathString: String, scale: Float): Path {
        val path = Path()
        val tokens = tokenizePath(pathString)

        var i = 0
        var currentX = 0f
        var currentY = 0f
        var lastCommand = ' '

        while (i < tokens.size) {
            val token = tokens[i]
            val isCommand = token.length == 1 && token[0].isLetter()

            val command: Char
            if (isCommand) {
                command = token[0]
                lastCommand = command
                i++
            } else {
                // Implicit repeat of the last command
                // After M, implicit commands become L (SVG spec)
                command = when (lastCommand) {
                    'M' -> 'L'
                    'm' -> 'l'
                    else -> lastCommand
                }
            }

            when (command) {
                'M' -> {
                    if (i + 1 < tokens.size) {
                        currentX = (tokens[i].toFloatOrNull() ?: 0f) * scale
                        currentY = (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        path.moveTo(currentX, currentY)
                        i += 2
                    }
                }
                'm' -> {
                    if (i + 1 < tokens.size) {
                        currentX += (tokens[i].toFloatOrNull() ?: 0f) * scale
                        currentY += (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        path.moveTo(currentX, currentY)
                        i += 2
                    }
                }
                'L' -> {
                    if (i + 1 < tokens.size) {
                        currentX = (tokens[i].toFloatOrNull() ?: 0f) * scale
                        currentY = (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        path.lineTo(currentX, currentY)
                        i += 2
                    }
                }
                'l' -> {
                    if (i + 1 < tokens.size) {
                        currentX += (tokens[i].toFloatOrNull() ?: 0f) * scale
                        currentY += (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        path.lineTo(currentX, currentY)
                        i += 2
                    }
                }
                'H' -> {
                    if (i < tokens.size) {
                        currentX = (tokens[i].toFloatOrNull() ?: 0f) * scale
                        path.lineTo(currentX, currentY)
                        i += 1
                    }
                }
                'h' -> {
                    if (i < tokens.size) {
                        currentX += (tokens[i].toFloatOrNull() ?: 0f) * scale
                        path.lineTo(currentX, currentY)
                        i += 1
                    }
                }
                'V' -> {
                    if (i < tokens.size) {
                        currentY = (tokens[i].toFloatOrNull() ?: 0f) * scale
                        path.lineTo(currentX, currentY)
                        i += 1
                    }
                }
                'v' -> {
                    if (i < tokens.size) {
                        currentY += (tokens[i].toFloatOrNull() ?: 0f) * scale
                        path.lineTo(currentX, currentY)
                        i += 1
                    }
                }
                'Q' -> {
                    if (i + 3 < tokens.size) {
                        val cx = (tokens[i].toFloatOrNull() ?: 0f) * scale
                        val cy = (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        val ex = (tokens[i + 2].toFloatOrNull() ?: 0f) * scale
                        val ey = (tokens[i + 3].toFloatOrNull() ?: 0f) * scale
                        path.quadTo(cx, cy, ex, ey)
                        currentX = ex
                        currentY = ey
                        i += 4
                    }
                }
                'q' -> {
                    if (i + 3 < tokens.size) {
                        val cx = currentX + (tokens[i].toFloatOrNull() ?: 0f) * scale
                        val cy = currentY + (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        val ex = currentX + (tokens[i + 2].toFloatOrNull() ?: 0f) * scale
                        val ey = currentY + (tokens[i + 3].toFloatOrNull() ?: 0f) * scale
                        path.quadTo(cx, cy, ex, ey)
                        currentX = ex
                        currentY = ey
                        i += 4
                    }
                }
                'C' -> {
                    if (i + 5 < tokens.size) {
                        val c1x = (tokens[i].toFloatOrNull() ?: 0f) * scale
                        val c1y = (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        val c2x = (tokens[i + 2].toFloatOrNull() ?: 0f) * scale
                        val c2y = (tokens[i + 3].toFloatOrNull() ?: 0f) * scale
                        val ex = (tokens[i + 4].toFloatOrNull() ?: 0f) * scale
                        val ey = (tokens[i + 5].toFloatOrNull() ?: 0f) * scale
                        path.cubicTo(c1x, c1y, c2x, c2y, ex, ey)
                        currentX = ex
                        currentY = ey
                        i += 6
                    }
                }
                'c' -> {
                    if (i + 5 < tokens.size) {
                        val c1x = currentX + (tokens[i].toFloatOrNull() ?: 0f) * scale
                        val c1y = currentY + (tokens[i + 1].toFloatOrNull() ?: 0f) * scale
                        val c2x = currentX + (tokens[i + 2].toFloatOrNull() ?: 0f) * scale
                        val c2y = currentY + (tokens[i + 3].toFloatOrNull() ?: 0f) * scale
                        val ex = currentX + (tokens[i + 4].toFloatOrNull() ?: 0f) * scale
                        val ey = currentY + (tokens[i + 5].toFloatOrNull() ?: 0f) * scale
                        path.cubicTo(c1x, c1y, c2x, c2y, ex, ey)
                        currentX = ex
                        currentY = ey
                        i += 6
                    }
                }
                'Z', 'z' -> path.close()
                else -> {
                    // Unknown command, skip the token
                    i++
                }
            }
        }

        return path
    }

    private fun tokenizePath(pathString: String): List<String> {
        val tokens = mutableListOf<String>()
        var current = StringBuilder()

        for (char in pathString) {
            when {
                char.isLetter() -> {
                    if (current.isNotEmpty()) {
                        tokens.add(current.toString())
                        current = StringBuilder()
                    }
                    tokens.add(char.toString())
                }
                char == ',' || char == ' ' -> {
                    if (current.isNotEmpty()) {
                        tokens.add(current.toString())
                        current = StringBuilder()
                    }
                }
                char == '-' && current.isNotEmpty() -> {
                    tokens.add(current.toString())
                    current = StringBuilder()
                    current.append(char)
                }
                else -> current.append(char)
            }
        }

        if (current.isNotEmpty()) {
            tokens.add(current.toString())
        }

        return tokens
    }
}
