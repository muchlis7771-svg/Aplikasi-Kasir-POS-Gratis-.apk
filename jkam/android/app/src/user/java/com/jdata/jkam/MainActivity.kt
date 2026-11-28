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
        findViewById<SwitchCompat>(R.id.remoteCtl).apply {
            isChecked = p.remoteControl
            setOnCheckedChangeListener { _, c ->
                p.remoteControl = c
                if (c) { CommandWorker.schedule(this@MainActivity); applyStandby() }
                else {
                    CommandWorker.cancel(this@MainActivity); ui.removeCallbacks(cmdTick)
                    if (!RecorderService.running) RecorderService.shutdown(this@MainActivity)
                }
            }
        }
        findViewById<SwitchCompat>(R.id.standbyMode).apply {
            isChecked = p.standbyMode
            setOnCheckedChangeListener { _, c ->
                p.standbyMode = c
                applyStandby()
                if (!c && !RecorderService.running) RecorderService.shutdown(this@MainActivity)
            }
        }
        findViewById<Button>(R.id.btnPin).setOnClickListener { pinDialog() }
        findViewById<Button>(R.id.btnProtect).setOnClickListener { protectDialog() }
        findViewById<Button>(R.id.battery).setOnClickListener { askBattery() }
        findViewById<TextView>(R.id.versionText).text = "Versi " + BuildConfig.VERSION_NAME
        findViewById<Button>(R.id.btnUpdate).setOnClickListener { checkUpdateManual() }

        recBtn.setOnClickListener { if (RecorderService.running) confirmStop() else startRec() }
        findViewById<android.view.View>(R.id.logout).setOnClickListener { confirmLogout() }
        findViewById<ImageView>(R.id.refresh).setOnClickListener {
            it.animate().rotationBy(360f).setDuration(600).start()
            checkLicense(); checkUpdate(); UploadWorker.enqueueAll(this, replace = true)
            Toast.makeText(this, "Diperbarui", Toast.LENGTH_SHORT).show()
        }
        findViewById<TextView>(R.id.updateBtn).setOnClickListener { startUpdate() }

        UploadWorker.enqueueAll(this) // pastikan sisa rekaman terkirim
        if (p.remoteControl) CommandWorker.schedule(this)
        handleStartIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (p.hasPin && !AppLock.unlocked) { startActivity(Intent(this, LockActivity::class.java)); return }
        ui.post(tick)
        checkLicense()
        ForcedUpdate.gate(this)      // pembaruan WAJIB saat dibuka
        ensureNotifPermission()
        FirebaseMsgService.registerToken(this)
        applyStandby()
        refreshSecurity()
    }

    override fun onStop() {
        super.onStop()
        AppLock.unlocked = false     // minta PIN lagi saat aplikasi dibuka kembali
    }

    /**
     * Mode Siaga: saat aktif, jalankan RecorderService dalam keadaan siaga (foreground hidup,
     * mikrofon mati). Owner bisa memulai rekaman dari jauh TANPA user mengetuk apa pun karena
     * service sudah hidup dari foreground — tidak terkena batasan start-FGS-dari-background
     * Android 12+. Saat Mode Siaga mati, kembali ke polling lama (perlu konfirmasi user).
     */
    private fun applyStandby() {
        ui.removeCallbacks(cmdTick)
        val standby = p.remoteControl && p.standbyMode
        if (standby) {
            if (!RecorderService.alive) RecorderService.enterStandby(this)
        } else if (p.remoteControl) {
            ui.post(cmdTick) // polling + dialog konfirmasi (perilaku lama)
        }
    }

    override fun onPause() {
        super.onPause()
        ui.removeCallbacks(tick)
        ui.removeCallbacks(cmdTick)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleStartIntent(intent)
    }

    /** Dibuka dari notifikasi "Owner meminta mulai merekam": langsung mulai (user sudah mengetuk). */
    private fun handleStartIntent(intent: Intent?) {
        if (intent?.getBooleanExtra("start_cmd", false) == true) {
            intent.removeExtra("start_cmd")
            if (!RecorderService.running) startRec()
        }
    }

    // Polling perintah saat aplikasi terbuka & belum merekam (saat merekam, service yang cek)
    @Volatile private var cmdPolling = false
    private val cmdTick = object : Runnable {
        override fun run() {
            if (p.remoteControl && !RecorderService.running && !cmdPolling) {
                cmdPolling = true
                Thread {
                    val cmd = Api.command(p)
                    cmdPolling = false
                    if (cmd != null) {
                        when (cmd.first) {
                            "start" -> { Api.ackCommand(p, cmd.second); runOnUiThread { if (!RecorderService.running) promptStartFromOwner() } }
                            "release" -> { Api.ackCommand(p, cmd.second); runOnUiThread { CommandOps.release(this); refreshSecurity() } }
                        }
                    }
                }.start()
            }
            ui.postDelayed(this, 15_000)
        }
    }

    private var startDialogOpen = false
    private fun promptStartFromOwner() {
        if (startDialogOpen || RecorderService.running) return
        startDialogOpen = true
        AlertDialog.Builder(this)
            .setTitle("Owner meminta mulai merekam")
            .setMessage("Owner Anda meminta perekaman dimulai sekarang. Notifikasi JKam akan tampil selama merekam.")
            .setPositiveButton("Mulai") { _, _ -> startDialogOpen = false; startRec() }
            .setNegativeButton("Nanti") { _, _ -> startDialogOpen = false }
            .setOnCancelListener { startDialogOpen = false }
            .show()
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
            val siaga = RecorderService.alive && p.remoteControl && p.standbyMode
            status.text = RecorderService.lastError ?: if (siaga) "● Siaga — Owner dapat memulai kapan saja" else "Siap merekam"
            status.setTextColor(ContextCompat.getColor(this, if (RecorderService.lastError != null) R.color.bad else if (siaga) R.color.ok else R.color.mut))
            hint.text = if (siaga) "Owner bisa mulai dari jauh · ketuk untuk mulai manual" else "Ketuk untuk mulai merekam"
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

    @Volatile private var serverVersion = ""
    private fun checkUpdate() {
        Thread {
            val r = Api.call(p.serverUrl, "/api/public/apps")
            val server = r.json.optString("version", "")
            val newer = r.ok && buildNum(server) > buildNum(BuildConfig.VERSION_NAME)
            runOnUiThread {
                serverVersion = server
                findViewById<View>(R.id.updateBanner).visibility = if (newer) View.VISIBLE else View.GONE
                if (newer) {
                    findViewById<TextView>(R.id.updateText).text = "Versi baru JKam tersedia (v$server)"
                    // Update otomatis: unduh & buka pemasang sekali per versi (bukan saat merekam)
                    if (p.autoUpdate && p.updateHandled != server && !RecorderService.running && AppUpdater.canInstall(this)) {
                        p.updateHandled = server
                        AppUpdater.downloadAndInstall(this, p.serverUrl + "/download/jkam-user.apk") { s -> Toast.makeText(this, s, Toast.LENGTH_SHORT).show() }
                    }
                }
            }
        }.start()
    }

    /** Tombol "Perbarui aplikasi": cek versi, kalau ada yang baru langsung unduh+pasang, kalau tidak beri tahu. */
    private fun checkUpdateManual() {
        Toast.makeText(this, "Memeriksa pembaruan…", Toast.LENGTH_SHORT).show()
        Thread {
            val r = Api.call(p.serverUrl, "/api/public/apps")
            val server = r.json.optString("version", "")
            runOnUiThread {
                when {
                    !r.ok -> Toast.makeText(this, "Tidak bisa cek pembaruan (offline?)", Toast.LENGTH_SHORT).show()
                    buildNum(server) > buildNum(BuildConfig.VERSION_NAME) -> { p.updateHandled = server; startUpdate() }
                    else -> Toast.makeText(this, "Sudah versi terbaru (v" + BuildConfig.VERSION_NAME + ")", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }

    private fun startUpdate() {
        if (!AppUpdater.canInstall(this)) {
            AlertDialog.Builder(this)
                .setTitle("Izinkan pemasangan")
                .setMessage("Agar JKam bisa memperbarui sendiri, izinkan \"Pasang aplikasi tak dikenal\" untuk JKam.")
                .setPositiveButton("Buka pengaturan") { _, _ -> AppUpdater.openInstallSettings(this) }
                .setNegativeButton("Batal", null).show()
            return
        }
        AppUpdater.downloadAndInstall(this, p.serverUrl + "/download/jkam-user.apk") { s -> Toast.makeText(this, s, Toast.LENGTH_SHORT).show() }
    }

    private val permLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { res ->
        if (res[Manifest.permission.RECORD_AUDIO] == true) startRec()
        else Toast.makeText(this, "Izin mikrofon diperlukan untuk merekam", Toast.LENGTH_LONG).show()
    }

    // Minta izin notifikasi saat login supaya perintah "mulai" dari Owner bisa tampil
    private val notifLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { }
    private var notifAsked = false
    private fun ensureNotifPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !notifAsked &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifAsked = true
            notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
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
                CommandWorker.cancel(this)
                RecorderService.shutdown(this)
                p.logout()
                startActivity(Intent(this, LoginActivity::class.java)); finish()
            }
            .setNegativeButton("Batal", null).show()
    }

    // ---------- Keamanan: PIN & perlindungan anti-copot ----------
    private fun refreshSecurity() {
        findViewById<TextView>(R.id.pinStatus).text =
            if (p.hasPin) "PIN aktif — diminta saat membuka aplikasi" else "PIN belum diatur"
        findViewById<Button>(R.id.btnPin).text = if (p.hasPin) "Ubah / hapus PIN" else "Atur PIN aplikasi"

        // Jika admin baru saja disetujui, kunci pencopotan & tandai diinginkan.
        if (DeviceLock.protectionActive(this)) {
            DeviceLock.enableBlock(this)
            p.protectionWanted = true
        }
        val active = DeviceLock.protectionActive(this)
        val owner = DeviceLock.isDeviceOwner(this)
        findViewById<TextView>(R.id.protectStatus).text = when {
            owner  -> "Aktif (kunci penuh) — hanya owner yang bisa melepas"
            active -> "Aktif — wajib dinonaktifkan dulu sebelum bisa dihapus"
            else   -> "Nonaktif — aplikasi bisa dihapus"
        }
        findViewById<Button>(R.id.btnProtect).text = if (active) "Perlindungan aktif" else "Aktifkan perlindungan anti-copot"
    }

    private fun pinField(): EditText = EditText(this).apply {
        inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        hint = "PIN (4–12 angka)"
    }

    private fun pinDialog() {
        if (p.hasPin) {
            AlertDialog.Builder(this).setTitle("PIN aplikasi")
                .setItems(arrayOf("Ubah PIN", "Hapus PIN")) { _, which ->
                    if (which == 0) setPinDialog() else {
                        AppLock.clear(p)
                        Toast.makeText(this, "PIN dihapus", Toast.LENGTH_SHORT).show()
                        refreshSecurity()
                    }
                }.setNegativeButton("Batal", null).show()
        } else setPinDialog()
    }

    private fun setPinDialog() {
        val a = pinField(); val b = pinField().apply { hint = "Ulangi PIN" }
        val box = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 16, 48, 0); addView(a); addView(b)
        }
        AlertDialog.Builder(this).setTitle("Atur PIN")
            .setMessage("PIN akan diminta setiap membuka aplikasi.")
            .setView(box)
            .setPositiveButton("Simpan") { _, _ ->
                val p1 = a.text.toString(); val p2 = b.text.toString()
                when {
                    p1.length < 4 -> Toast.makeText(this, "PIN minimal 4 angka", Toast.LENGTH_SHORT).show()
                    p1 != p2 -> Toast.makeText(this, "PIN tidak sama", Toast.LENGTH_SHORT).show()
                    else -> {
                        AppLock.setPin(p, p1); AppLock.unlocked = true
                        Toast.makeText(this, "PIN disimpan", Toast.LENGTH_SHORT).show(); refreshSecurity()
                    }
                }
            }
            .setNegativeButton("Batal", null).show()
    }

    private fun protectDialog() {
        if (DeviceLock.protectionActive(this)) {
            AlertDialog.Builder(this).setTitle("Perlindungan aktif")
                .setMessage("Aplikasi ini dilindungi agar tidak mudah dihapus. " +
                    "Owner dapat melepas perlindungan kapan saja dari dashboard, lalu aplikasi bisa dihapus.")
                .setPositiveButton("Mengerti", null).show()
            return
        }
        AlertDialog.Builder(this).setTitle("Aktifkan perlindungan anti-copot")
            .setMessage("JKam akan dijadikan admin perangkat agar tidak bisa dihapus tanpa izin. " +
                "Android akan menampilkan layar persetujuan. Owner tetap bisa melepasnya dari dashboard.\n\n" +
                "Perekaman tetap transparan: notifikasi JKam dan titik hijau mikrofon tetap tampil.")
            .setPositiveButton("Lanjut") { _, _ ->
                p.protectionWanted = true
                try { startActivity(DeviceLock.addAdminIntent(this)) }
                catch (_: Exception) { Toast.makeText(this, "Tidak bisa membuka pengaturan admin", Toast.LENGTH_SHORT).show() }
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
