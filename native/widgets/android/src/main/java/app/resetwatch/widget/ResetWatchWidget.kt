package app.resetwatch.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.URL
import java.io.ByteArrayOutputStream
import javax.net.ssl.HttpsURLConnection
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** Library provider for a real Android host. No account token or personal quota access. */
class ResetWatchWidget : AppWidgetProvider() {
    companion object {
        private val running = AtomicBoolean(false)
        private val executor = Executors.newSingleThreadExecutor()
        private val time = DateTimeFormatter.ofPattern("MM月dd日 HH:mm").withZone(ZoneId.of("Asia/Shanghai"))
        private fun stamp(value: String): String = try { time.format(Instant.parse(value)) } catch (_: Exception) { "未知" }
    }
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            super.onReceive(context, intent); return
        }
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, ResetWatchWidget::class.java))
        if (ids.isEmpty() || !running.compareAndSet(false, true)) return
        val result = goAsync()
        executor.execute {
            try { update(context, manager, ids) } finally { running.set(false); result.finish() }
        }
    }
    private fun origin(context: Context): URL {
        val url = URL(context.getString(R.string.resetwatch_api_origin))
        require(url.protocol == "https" && url.host.isNotEmpty() && !url.host.endsWith(".example"))
        require(url.host != "localhost" && url.userInfo == null && url.query == null && url.ref == null)
        require(url.path.isEmpty() || url.path == "/")
        return url
    }
    private fun update(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val views = RemoteViews(context.packageName, R.layout.resetwatch_widget)
        var root: URL? = null
        try {
            root = origin(context)
            val connection = URL(root, "/api/v1/product?view=widget").openConnection() as HttpsURLConnection
            val snapshot: JSONObject
            try {
                connection.connectTimeout = 3000
                connection.readTimeout = 3000
                connection.instanceFollowRedirects = false
                connection.useCaches = false
                require(connection.responseCode == 200)
                val bytes = connection.inputStream.use { input ->
                    val output = ByteArrayOutputStream()
                    val buffer = ByteArray(4096)
                    val started = System.nanoTime()
                    while (output.size() <= 32768) {
                        check(System.nanoTime() - started < 8_000_000_000L)
                        val count = input.read(buffer)
                        if (count == -1) break
                        output.write(buffer, 0, count)
                    }
                    output.toByteArray()
                }
                require(bytes.size <= 32768)
                snapshot = JSONObject(bytes.toString(Charsets.UTF_8))
            } finally { connection.disconnect() }
            if (!snapshot.optBoolean("available")) throw IllegalStateException()
            views.setTextViewText(R.id.resetwatch_title, snapshot.optString("title", "ResetWatch").take(200))
            views.setTextViewText(R.id.resetwatch_state, snapshot.optString("statusLabel", "状态未知"))
            val confirmed = snapshot.optString("confirmedAt").takeUnless { it == "null" || it.isBlank() }
            views.setTextViewText(R.id.resetwatch_window, if (confirmed != null) "官方确认：北京时间 ${stamp(confirmed)}"
                else "参考最晚：北京时间 ${stamp(snapshot.optString("deadlineAt"))}，可能提前")
            views.setTextViewText(R.id.resetwatch_updated, "快照：${stamp(snapshot.optString("serverTime"))} · 北京时间")
        } catch (_: Exception) {
            views.setTextViewText(R.id.resetwatch_title, "ResetWatch")
            views.setTextViewText(R.id.resetwatch_state, "服务未就绪或读取失败，状态未知")
            views.setTextViewText(R.id.resetwatch_window, "重置最晚时间未知")
            views.setTextViewText(R.id.resetwatch_updated, "请打开工作台核验；不代表没有 Reset")
        }
        if (root != null) {
            val click = Intent(Intent.ACTION_VIEW, Uri.parse(URL(root, "/workbench").toString()))
            views.setOnClickPendingIntent(R.id.resetwatch_root,
                PendingIntent.getActivity(context, 0, click, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        manager.updateAppWidget(ids, views)
    }
}
