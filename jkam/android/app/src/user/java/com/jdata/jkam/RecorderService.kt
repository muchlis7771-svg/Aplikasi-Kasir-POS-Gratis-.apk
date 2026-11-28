package com.jdata.jkam

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

/**
 * Layanan perekam dengan dua keadaan dalam satu layanan latar depan:
 *  - SIAGA   : hidup, notifikasi kecil permanen, TIDAK membuka mikrofon (tidak ada titik hijau).
 *              Owner bisa memulai rekaman kapan saja tanpa user menekan apa pun.
 *  - MEREKAM : mikrofon aktif (titik hijau + notifikasi), menyimpan & mengunggah potongan.
 *
 * Karena layanan sudah hidup (dinyalakan dari depan saat login), memulai rekaman saat
 * ada perintah TIDAK terkena larangan "mulai mikrofon dari latar belakang" Android 12+.
 */
class RecorderService : Service() {

    companion object {
        const val ACTION_STANDBY = "com.jdata.jkam.STANDBY"   // masuk mode siaga
        const val ACTION_START = "com.jdata.jkam.START"       // mulai merekam
        const val ACTION_STOP = "com.jdata.jkam.STOP"         // berhenti merekam (tetap siaga)
        const val ACTION_SHUTDOWN = "com.jdata.jkam.SHUTDOWN" // matikan total (keluar siaga)
        private const val CHANNEL = "jkam_rec"
        private const val NOTIF_ID = 7
        private const val SAMPLE_RATE = 48000

        @Volatile var running = false     // sedang merekam
        @Volatile var alive = false       // layanan hidup (siaga atau merekam)
        @Volatile var startedAt = 0L
        @Volatile var level = 0           // 0..100
        @Volatile var chunks = 0
        @Volatile var lastError: String? = null

        fun enterStandby(ctx: Context) {
            androidx.core.content.ContextCompat.startForegroundService(
                ctx, Intent(ctx, RecorderService::class.java).setAction(ACTION_STANDBY))
        }
        fun start(ctx: Context) {
            androidx.core.content.ContextCompat.startForegroundService(
                ctx, Intent(ctx, RecorderService::class.java).setAction(ACTION_START))
        }
        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, RecorderService::class.java).setAction(ACTION_STOP))
        }
        fun shutdown(ctx: Context) {
            ctx.startService(Intent(ctx, RecorderService::class.java).setAction(ACTION_SHUTDOWN))
        }
    }

    @Volatile private var recStopFlag = false
    private var recordThread: Thread? = null
    private var pollerThread: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val main = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHUTDOWN -> { shutdown(); return START_NOT_STICKY }
            ACTION_STOP -> {
                stopRecordLoop(byOwner = false)
                return START_STICKY
            }
        }
        // ACTION_STANDBY, ACTION_START, atau di-restart sistem (null)
        if (!alive) {
            try { goForeground(recordingNow = false) }
            catch (e: Exception) {
                lastError = "Tidak bisa jalan dari latar belakang. Buka JKam sekali."
                stopSelf(); return START_NOT_STICKY
            }
            alive = true
            startPoller()
        }
        if (intent?.action == ACTION_START) startRecordLoop()
        return START_STICKY
    }

    // ---------- notifikasi ----------
    private fun buildNotification(recordingNow: Boolean, text: String): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "JKam", NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val b = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_mic)
            .setOngoing(true)
            .setContentIntent(open)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (recordingNow) {
            val stop = PendingIntent.getService(
                this, 1, Intent(this, RecorderService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
            b.setContentTitle("JKam sedang merekam").setContentText(text).addAction(0, "Berhenti", stop)
        } else {
            b.setContentTitle("JKam siaga").setContentText("Owner dapat memulai rekaman kapan saja")
        }
        return b.build()
    }

    private fun goForeground(recordingNow: Boolean) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(recordingNow, ""), type)
    }

    private fun updateNotification(recordingNow: Boolean, text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotification(recordingNow, text))
    }

    // ---------- poller perintah (hidup selama layanan hidup) ----------
    private fun startPoller() {
        if (pollerThread != null) return
        pollerThread = Thread({
            val p = Prefs(this)
            var i = 0
            while (alive) {
                try {
                    if (i % 8 == 0) Api.heartbeat(p, running)
                    if (p.remoteControl) {
                        val cmd = Api.command(p)
                        if (cmd != null) {
                            Api.ackCommand(p, cmd.second)
                            if (cmd.first == "start" && !running) main.post { startRecordLoop() }
                            else if (cmd.first == "stop" && running) main.post {
                                CommandNotif.show(this, "JKam dihentikan Owner", "Owner meminta rekaman dihentikan.")
                                stopRecordLoop(byOwner = true)
                            }
                        }
                    }
                } catch (_: Exception) {}
                i++
                try { Thread.sleep(if (running) 15_000 else 9_000) } catch (_: InterruptedException) { break }
            }
        }, "jkam-poll").apply { isDaemon = true; start() }
    }

    // ---------- kendali rekaman ----------
    private fun startRecordLoop() {
        if (running || !alive) return
        running = true
        recStopFlag = false
        lastError = null
        chunks = 0
        startedAt = System.currentTimeMillis()
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JKam::rec").apply {
            setReferenceCounted(false); acquire(26L * 3600 * 1000)
        }
        updateNotification(true, "Merekam…")
        recordThread = Thread({ recordLoop(); onRecordEnded() }, "jkam-rec").apply { start() }
        Thread { Api.heartbeat(Prefs(this), true) }.start()
    }

    /** Hentikan rekaman tanpa mematikan layanan (tetap siaga bila diaktifkan). */
    private fun stopRecordLoop(byOwner: Boolean) {
        if (!running) return
        recStopFlag = true
        // recordLoop akan keluar (<200ms) lalu memanggil onRecordEnded()
    }

    private fun onRecordEnded() {
        try { wakeLock?.release() } catch (_: Exception) {}
        wakeLock = null
        running = false
        level = 0
        Thread { Api.heartbeat(Prefs(this), false) }.start()
        main.post {
            if (!alive) return@post
            if (Prefs(this).standbyMode) updateNotification(false, "")   // kembali siaga
            else shutdown()                                               // siaga mati -> matikan total
        }
    }

    private fun shutdown() {
        alive = false
        recStopFlag = true
        running = false
        level = 0
        try { wakeLock?.release() } catch (_: Exception) {}
        wakeLock = null
        Thread { Api.heartbeat(Prefs(this), false) }.start()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    @SuppressLint("MissingPermission")
    private fun recordLoop() {
        val p = Prefs(this)
        val source = if (p.voiceMode) MediaRecorder.AudioSource.VOICE_COMMUNICATION else MediaRecorder.AudioSource.MIC
        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val rec = try {
            AudioRecord(source, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, max(minBuf * 4, SAMPLE_RATE))
        } catch (e: Exception) {
            lastError = "Mikrofon tidak bisa dibuka: ${e.message}"
            return
        }
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            lastError = "Mikrofon sedang dipakai aplikasi lain atau izin ditolak"
            rec.release(); return
        }

        var ns: NoiseSuppressor? = null
        if (p.enhance && NoiseSuppressor.isAvailable()) {
            ns = try { NoiseSuppressor.create(rec.audioSessionId)?.apply { enabled = true } } catch (_: Exception) { null }
        }
        val enhancer = if (p.enhance) VoiceEnhancer(SAMPLE_RATE) else null
        val enhancedFlag = if (p.enhance) 1 else 0

        val sessionId = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date()) +
            "-" + Integer.toHexString((Math.random() * 0xFFFF).toInt())
        val workDir = File(filesDir, "recording").apply { mkdirs() }
        val chunkSamples = p.chunkMinutes * 60L * SAMPLE_RATE
        val maxMs = p.maxHours * 3600_000L
        val frame = ShortArray(SAMPLE_RATE / 10) // 100 ms

        var seq = 0
        var writer: AacWriter? = null
        var chunkStart = 0L
        var written = 0L

        fun closeChunk() {
            val w = writer ?: return
            writer = null
            val dur = w.durationMs
            if (w.finish()) {
                val dst = File(UploadWorker.pendingDir(this), "${sessionId}_${seq}_${chunkStart}_${dur}_$enhancedFlag.m4a")
                if (w.file.renameTo(dst)) {
                    UploadWorker.enqueue(this, dst)
                    chunks++
                }
            }
        }

        fun openChunk() {
            seq++
            chunkStart = System.currentTimeMillis()
            written = 0
            writer = AacWriter(File(workDir, "${sessionId}_$seq.part"), SAMPLE_RATE, p.bitRate)
        }

        try {
            rec.startRecording()
            openChunk()
            while (!recStopFlag) {
                val n = rec.read(frame, 0, frame.size)
                if (n < 0) {
                    if (n == AudioRecord.ERROR_DEAD_OBJECT) { lastError = "Mikrofon terputus"; break }
                    continue
                }
                if (n == 0) continue
                enhancer?.process(frame, n)

                var peak = 0
                for (i in 0 until n) { val a = abs(frame[i].toInt()); if (a > peak) peak = a }
                level = peak * 100 / 32768

                writer?.write(frame, n)
                written += n

                if (written >= chunkSamples) {
                    closeChunk()
                    val h = (System.currentTimeMillis() - startedAt) / 3600_000
                    val m = (System.currentTimeMillis() - startedAt) / 60_000 % 60
                    main.post { if (running) updateNotification(true, "${h}j ${m}m · $chunks potongan tersimpan") }
                    openChunk()
                }
                if (maxMs > 0 && System.currentTimeMillis() - startedAt >= maxMs) break
            }
        } catch (e: Exception) {
            lastError = "Error: ${e.message}"
        } finally {
            try { closeChunk() } catch (_: Exception) {}
            try { rec.stop() } catch (_: Exception) {}
            rec.release()
            ns?.release()
        }
    }

    override fun onDestroy() {
        alive = false
        recStopFlag = true
        running = false
        super.onDestroy()
    }
}
