package com.jdata.jkam

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.ViewGroup
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

/** APK Head Admin & Owner: menampilkan panel JKam dari Worker di dalam aplikasi. */
class PanelActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var loading: ProgressBar
    private lateinit var prefs: Prefs

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true; isAppearanceLightNavigationBars = true
        }

        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#F4F6FB")) }
        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F4F6FB"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            settings.userAgentString = settings.userAgentString + " JKamApp/" + BuildConfig.ROLE
            webChromeClient = WebChromeClient() // aktifkan dialog konfirmasi
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) { loading.visibility = View.GONE }
                override fun onReceivedError(view: WebView?, req: WebResourceRequest?, err: WebResourceError?) {
                    if (req?.isForMainFrame == true) showOffline()
                }
                override fun shouldOverrideUrlLoading(view: WebView?, req: WebResourceRequest?): Boolean {
                    val u = req?.url ?: return false
                    val host = Uri.parse(prefs.serverUrl).host
                    if (u.host == host) return false
                    startActivity(Intent(Intent.ACTION_VIEW, u)); return true
                }
            }
            setDownloadListener { url, ua, cd, mime, _ ->
                try {
                    val name = URLUtil.guessFileName(url, cd, mime).let { if (it.endsWith(".m4a")) it else "JKam-rekaman.m4a" }
                    val req = DownloadManager.Request(Uri.parse(url))
                        .setTitle(name).setMimeType("audio/mp4")
                        .addRequestHeader("User-Agent", ua)
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "JKam/$name")
                    getSystemService(DownloadManager::class.java).enqueue(req)
                    Toast.makeText(this@PanelActivity, "Mengunduh ke Download/JKam", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(this@PanelActivity, "Gagal mengunduh", Toast.LENGTH_SHORT).show()
                }
            }
        }
        loading = ProgressBar(this).apply { isIndeterminate = true }
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(loading, FrameLayout.LayoutParams(120, 120, android.view.Gravity.CENTER))

        // Tombol pembaruan manual (kecil, pojok bawah)
        val dp = resources.displayMetrics.density
        val upd = android.widget.TextView(this).apply {
            text = "⟳ Perbarui"
            setTextColor(Color.parseColor("#6D28D9"))
            setBackgroundColor(Color.parseColor("#F1ECFB"))
            setPadding((14 * dp).toInt(), (8 * dp).toInt(), (14 * dp).toInt(), (8 * dp).toInt())
            textSize = 13f
            isClickable = true
            setOnClickListener { checkUpdateManual() }
        }
        root.addView(upd, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
            android.view.Gravity.BOTTOM or android.view.Gravity.END).apply {
            setMargins(0, 0, (12 * dp).toInt(), (14 * dp).toInt())
        })
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })

        if (prefs.serverUrl.isBlank()) askServer() else load()
    }

    override fun onResume() {
        super.onResume()
        if (prefs.serverUrl.isNotBlank()) ForcedUpdate.gate(this) // pembaruan wajib saat dibuka
    }

    /** Tombol "Perbarui": cek versi; kalau ada yang baru langsung unduh+pasang, kalau tidak beri tahu. */
    private fun checkUpdateManual() {
        Toast.makeText(this, "Memeriksa pembaruan…", Toast.LENGTH_SHORT).show()
        Thread {
            val r = Api.call(prefs.serverUrl, "/api/public/apps")
            val server = r.json.optString("version", "")
            val newer = r.ok && (server.substringAfterLast('.').toIntOrNull() ?: 0) >
                (BuildConfig.VERSION_NAME.substringAfterLast('.').toIntOrNull() ?: 0)
            runOnUiThread {
                when {
                    !r.ok -> Toast.makeText(this, "Tidak bisa cek pembaruan (offline?)", Toast.LENGTH_SHORT).show()
                    newer -> ForcedUpdate.gate(this)
                    else -> Toast.makeText(this, "Sudah versi terbaru (v" + BuildConfig.VERSION_NAME + ")", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    private fun load() {
        loading.visibility = View.VISIBLE
        web.loadUrl(prefs.serverUrl + "/?app=" + BuildConfig.ROLE)
    }

    private fun askServer() {
        val input = EditText(this).apply {
            hint = "https://jkam-api.namaanda.workers.dev"
            setText(prefs.serverUrl)
            setSingleLine()
        }
        val box = LinearLayout(this).apply { setPadding(48, 16, 48, 0); addView(input) }
        AlertDialog.Builder(this)
            .setTitle("Alamat server JKam")
            .setView(box)
            .setCancelable(false)
            .setPositiveButton("Simpan") { _, _ ->
                var url = input.text.toString().trim()
                if (url.isNotEmpty() && !url.startsWith("http")) url = "https://$url"
                prefs.serverUrl = url
                if (url.isBlank()) askServer() else load()
            }
            .show()
    }

    private fun showOffline() {
        loading.visibility = View.GONE
        AlertDialog.Builder(this)
            .setTitle("Tidak bisa terhubung")
            .setMessage("Periksa internet Anda.\nServer: ${prefs.serverUrl}")
            .setCancelable(false)
            .setPositiveButton("Coba lagi") { _, _ -> load() }
            .setNeutralButton("Ganti server") { _, _ -> askServer() }
            .setNegativeButton("Tutup") { _, _ -> finish() }
            .show()
    }
}
