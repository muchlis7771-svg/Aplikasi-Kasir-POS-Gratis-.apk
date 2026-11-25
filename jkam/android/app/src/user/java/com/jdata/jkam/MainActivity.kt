package com.jdata.jkam

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.view.View
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.Editable
import android.text.TextWatcher
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var p: Prefs
    private val ui = Handler(Looper.getMainLooper())
    private lateinit var timer: TextView
    private lateinit var status: TextView
    private lateinit var hint: TextView
    private lateinit var level: ProgressBar
    private lateinit var chunks: TextView
    private lateinit var pending: TextView
    private lateinit var recBtn: FrameLayout
    private lateinit var recIcon: ImageView
    private lateinit var license: TextView
    private lateinit var settings: android.view.View

    private val tick = object : Runnable {
        override fun run() { refresh(); ui.postDelayed(this, 300) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        p = Prefs(this)
        if (!p.loggedIn) { startActivity(Intent(this, LoginActivity::class.java)); finish(); return }
        setContentView(R.layout.activity_main)

        timer = findViewById(R.id.timer); status = findViewById(R.id.status); hint = findViewById(R.id.hint)
        level = findViewById(R.id.level); chunks = findViewById(R.id.chunks); pending = findViewById(R.id.pending)
        recBtn = findViewById(R.id.recBtn); recIcon = findViewById(R.id.recIcon)
        license = findViewById(R.id.license); settings = findViewById(R.id.settings)
        findViewById<TextView>(R.id.name).text = p.userName.ifBlank { p.username }

        // Pengaturan
        val quality = findViewById<Spinner>(R.id.quality)
        quality.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item,
            listOf("Hemat — 32 kbps (±350 MB/24 jam)", "Standar — 48 kbps (±520 MB/24 jam)", "Tinggi — 96 kbps (±1 GB/24 jam)"))
        quality.setSelection(p.quality)
        quality.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(a: android.widget.AdapterView<*>?, v: android.view.View?, pos: Int, id: Long) { p.quality = pos }
            override fun onNothingSelected(a: android.widget.AdapterView<*>?) {}
        }
        bindNumber(findViewById(R.id.chunk), p.chunkMinutes) { p.chunkMinutes = it }
        bindNumber(findViewById(R.id.maxHours), p.maxHours) { p.maxHours = it }
        findViewById<SwitchCompat>(R.id.enhance).apply { isChecked = p.enhance; setOnCheckedChangeListener { _, c -> p.enhance = c } }
        findViewById<SwitchCompat>(R.id.voiceMode).apply { isChecked = p.voiceMode; setOnCheckedChangeListener { _, c -> p.voiceMode = c } }
        findViewById<SwitchCompat>(R.id.wifiOnly).apply {
            isChecked = p.wifiOnly
            setOnCheckedChangeListener { _, c -> p.wifiOnly = c; UploadWorker.enqueueAll(this@MainActivity, replace = true) }
        }
        findViewById<Button>(R.id.battery).setOnClickListener { askBattery() }

        recBtn.setOnClickListener { if (RecorderService.running) confirmStop() else startRec() }
        findViewById<android.view.View>(R.id.logout).setOnClickListener { confirmLogout() }
        findViewById<ImageView>(R.id.refresh).setOnClickListener {
            it.animate().rotationBy(360f).setDuration(600).start()
            checkLicense(); checkUpdate(); UploadWorker.enqueueAll(this, replace = true)
            Toast.makeText(this, "Diperbarui", Toast.LENGTH_SHORT).show()
        }
        findViewById<TextView>(R.id.updateBtn).setOnClickListener {
            try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(p.serverUrl + "/download/jkam-user.apk"))) } catch (_: Exception) {}
        }

        UploadWorker.enqueueAll(this) // pastikan sisa rekaman terkirim
    }

    override fun onResume() {
        super.onResume()
        ui.post(tick)
        checkLicense()
        checkUpdate()
    }

    override fun onPause() {
        super.onPause()
        ui.removeCallbacks(tick)
    }

    private fun bindNumber(e: EditText, value: Int, save: (Int) -> Unit) {
        e.setText(value.toString())
        e.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { s?.toString()?.toIntOrNull()?.let(save) }
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })
    }

    private fun refresh() {
        val on = RecorderService.running
        if (on) {
            val s = (System.currentTimeMillis() - RecorderService.startedAt) / 1000
            timer.text = String.format(Locale.US, "%02d:%02d:%02d", s / 3600, s / 60 % 60, s % 60)
            status.text = "● Merekam sejak " + SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(RecorderService.startedAt))
            status.setTextColor(ContextCompat.getColor(this, R.color.bad))
            hint.text = "Ketuk untuk berhenti"
            level.progress = RecorderService.level
            recBtn.setBackgroundResource(R.drawable.bg_rec_on)
            recIcon.setImageResource(R.drawable.ic_stop)
        } else {
            status.text = RecorderService.lastError ?: "Siap merekam"
            status.setTextColor(ContextCompat.getColor(this, if (RecorderService.lastError != null) R.color.bad else R.color.mut))
            hint.text = "Ketuk untuk mulai merekam"
            level.progress = 0
            recBtn.setBackgroundResource(R.drawable.bg_rec_idle)
            recIcon.setImageResource(R.drawable.ic_mic)
        }
        settings.alpha = if (on) 0.5f else 1f
        settings.isEnabled = !on
        chunks.text = RecorderService.chunks.toString()
        pending.text = UploadWorker.pendingCount(this).toString()
    }

    private fun checkLicense() {
        Thread {
            val r = Api.call(p.serverUrl, "/api/me", token = p.token)
            runOnUiThread {
                when {
                    r.code == 401 -> { license.text = "Sesi habis — silakan masuk lagi"; license.setTextColor(ContextCompat.getColor(this, R.color.bad)) }
                    r.code == 403 -> { license.text = r.error; license.setTextColor(ContextCompat.getColor(this, R.color.bad)) }
                    !r.ok -> license.text = "Offline — rekaman tetap disimpan di HP"
                    r.json.isNull("license") -> { license.text = "Lisensi owner tidak aktif — rekaman ditahan di HP"; license.setTextColor(ContextCompat.getColor(this, R.color.bad)) }
                    else -> {
                        val l = r.json.getJSONObject("license")
                        val until = SimpleDateFormat("dd MMM yyyy", Locale("id")).format(Date(l.getLong("expires_at")))
                        license.text = "Paket ${l.optString("package_name")} · aktif s/d $until"
                        license.setTextColor(ContextCompat.getColor(this, R.color.ok))
                    }
                }
            }
        }.start()
    }

    /** Angka build dari versionName "1.0.N" untuk membandingkan versi. */
    private fun buildNum(v: String?) = v?.substringAfterLast('.')?.toIntOrNull() ?: 0

    private fun checkUpdate() {
        Thread {
            val r = Api.call(p.serverUrl, "/api/public/apps")
            val server = r.json.optString("version", "")
            if (r.ok && buildNum(server) > buildNum(BuildConfig.VERSION_NAME)) {
                runOnUiThread {
                    findViewById<View>(R.id.updateBanner).visibility = View.VISIBLE
                    findViewById<TextView>(R.id.updateText).text = "Versi baru JKam tersedia (v$server)"
                }
            } else runOnUiThread { findViewById<View>(R.id.updateBanner).visibility = View.GONE }
        }.start()
    }

    private val permLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { res ->
        if (res[Manifest.permission.RECORD_AUDIO] == true) startRec()
        else Toast.makeText(this, "Izin mikrofon diperlukan untuk merekam", Toast.LENGTH_LONG).show()
    }

    private fun startRec() {
        val need = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            need += Manifest.permission.RECORD_AUDIO
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            need += Manifest.permission.POST_NOTIFICATIONS
        if (need.contains(Manifest.permission.RECORD_AUDIO) || (need.isNotEmpty() && !asked)) {
            asked = true
            permLauncher.launch(need.toTypedArray()); return
        }
        RecorderService.lastError = null
        RecorderService.start(this)
        if (!batteryIgnored()) Toast.makeText(this, "Tips: matikan optimasi baterai agar rekaman 24 jam tidak dihentikan HP", Toast.LENGTH_LONG).show()
    }
    private var asked = false

    private fun confirmStop() {
        AlertDialog.Builder(this).setTitle("Hentikan rekaman?")
            .setMessage("Potongan terakhir akan disimpan dan dikirim ke server.")
            .setPositiveButton("Berhenti") { _, _ -> RecorderService.stop(this) }
            .setNegativeButton("Lanjut merekam", null).show()
    }

    private fun confirmLogout() {
        if (RecorderService.running) { Toast.makeText(this, "Hentikan rekaman dulu", Toast.LENGTH_SHORT).show(); return }
        AlertDialog.Builder(this).setTitle("Keluar dari JKam?")
            .setMessage(if (UploadWorker.pendingCount(this) > 0) "Masih ada rekaman yang belum terkirim. Rekaman akan dikirim setelah Anda masuk lagi." else null)
            .setPositiveButton("Keluar") { _, _ ->
                Thread { Api.call(p.serverUrl, "/api/auth/logout", "POST", p.token) }.start()
                p.logout()
                startActivity(Intent(this, LoginActivity::class.java)); finish()
            }
            .setNegativeButton("Batal", null).show()
    }

    private fun batteryIgnored() = getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)

    @SuppressLint("BatteryLife")
    private fun askBattery() {
        if (batteryIgnored()) { Toast.makeText(this, "Sudah diizinkan ✔", Toast.LENGTH_SHORT).show(); return }
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }
}
