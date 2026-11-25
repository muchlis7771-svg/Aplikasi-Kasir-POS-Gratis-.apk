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

class RecorderService : Service() {

    companion object {
        const val ACTION_START = "com.jdata.jkam.START"
        const val ACTION_STOP = "com.jdata.jkam.STOP"
        private const val CHANNEL = "jkam_rec"
        private const val NOTIF_ID = 7
        private const val SAMPLE_RATE = 48000

        @Volatile var running = false
        @Volatile var startedAt = 0L
        @Volatile var level = 0          // 0..100
        @Volatile var chunks = 0
        @Volatile var lastError: String? = null

        fun start(ctx: Context) {
            val i = Intent(ctx, RecorderService::class.java).setAction(ACTION_START)
            androidx.core.content.ContextCompat.startForegroundService(ctx, i)
        }

        fun stop(ctx: Context) {
            ctx.startService(Intent(ctx, RecorderService::class.java).setAction(ACTION_STOP))
        }
    }

    @Volatile private var stopFlag = false
    private var thread: Thread? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val main = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopRecording()
            return START_NOT_STICKY
        }
        if (running) return START_STICKY
        try {
            startAsForeground()
        } catch (e: Exception) {
            // Android 12+ melarang mulai rekam dari latar belakang (mis. setelah sistem me-restart service)
            lastError = "Tidak bisa mulai dari latar belakang. Buka JKam lalu tekan Mulai."
            stopSelf()
            return START_NOT_STICKY
        }
        startRecording()
        return START_STICKY
    }

    private fun buildNotification(text: String): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Perekaman", NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, RecorderService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("JKam sedang merekam")
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(open)
            .addAction(0, "Berhenti", stop)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun startAsForeground() {
        val since = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification("Sejak $since"), type)
    }

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotification(text))
    }

    private fun startRecording() {
        running = true
        stopFlag = false
        lastError = null
        chunks = 0
        startedAt = System.currentTimeMillis()

        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "JKam::rec").apply {
            setReferenceCounted(false)
            acquire(26L * 3600 * 1000)
        }
        thread = Thread({ recordLoop() }, "jkam-rec").apply { start() }
        Thread({
            val p = Prefs(this)
            while (running && !stopFlag) {
                Api.heartbeat(p, true)
                try { Thread.sleep(120_000) } catch (_: InterruptedException) { break }
            }
        }, "jkam-hb").apply { isDaemon = true; start() }
    }

    private fun stopRecording() {
        stopFlag = true
        thread?.join(5000)
        thread = null
        finishService()
    }

    private fun finishService() {
        if (running) Thread { Api.heartbeat(Prefs(this), false) }.start()
        running = false
        level = 0
        try { wakeLock?.release() } catch (_: Exception) {}
        wakeLock = null
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
            main.post { finishService() }
            return
        }
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            lastError = "Mikrofon sedang dipakai aplikasi lain atau izin ditolak"
            rec.release()
            main.post { finishService() }
            return
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
            while (!stopFlag) {
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
                    main.post { if (running) updateNotification("${h}j ${m}m · $chunks potongan tersimpan") }
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
            if (!stopFlag) main.post { finishService() } // berhenti karena batas waktu/error
        }
    }

    override fun onDestroy() {
        stopFlag = true
        running = false
        super.onDestroy()
    }
}
