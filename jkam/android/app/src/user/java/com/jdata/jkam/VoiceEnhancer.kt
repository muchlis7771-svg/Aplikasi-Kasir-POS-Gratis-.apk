package com.jdata.jkam

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tanh

/**
 * Rantai pemrosesan suara supaya rekaman lebih jernih:
 *  1. High-pass 90 Hz     -> buang dengung, getaran meja, suara kipas rendah
 *  2. Low-pass 9 kHz      -> kurangi desis (hiss) frekuensi tinggi
 *  3. Presence EQ +4 dB @ 3 kHz -> suara orang lebih jelas/terang
 *  4. Noise gate adaptif  -> saat hening, noise latar diturunkan ~14 dB
 *  5. AGC (penguat otomatis) -> suara pelan/jauh diangkat, suara keras ditahan
 *  6. Soft limiter        -> cegah pecah/clipping
 */
class VoiceEnhancer(private val sampleRate: Int) {

    private class Biquad(
        private val b0: Float, private val b1: Float, private val b2: Float,
        private val a1: Float, private val a2: Float,
    ) {
        private var x1 = 0f; private var x2 = 0f; private var y1 = 0f; private var y2 = 0f
        fun process(x: Float): Float {
            val y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1; x1 = x; y2 = y1; y1 = y
            return y
        }

        companion object {
            private fun make(b0: Double, b1: Double, b2: Double, a0: Double, a1: Double, a2: Double) =
                Biquad((b0 / a0).toFloat(), (b1 / a0).toFloat(), (b2 / a0).toFloat(), (a1 / a0).toFloat(), (a2 / a0).toFloat())

            fun highPass(fs: Int, f: Double, q: Double): Biquad {
                val w = 2 * Math.PI * f / fs; val c = cos(w); val al = sin(w) / (2 * q)
                return make((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al)
            }

            fun lowPass(fs: Int, f: Double, q: Double): Biquad {
                val w = 2 * Math.PI * f / fs; val c = cos(w); val al = sin(w) / (2 * q)
                return make((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al)
            }

            fun peaking(fs: Int, f: Double, q: Double, gainDb: Double): Biquad {
                val a = 10.0.pow(gainDb / 40); val w = 2 * Math.PI * f / fs
                val c = cos(w); val al = sin(w) / (2 * q)
                return make(1 + al * a, -2 * c, 1 - al * a, 1 + al / a, -2 * c, 1 - al / a)
            }
        }
    }

    private val hp1 = Biquad.highPass(sampleRate, 90.0, 0.707)
    private val hp2 = Biquad.highPass(sampleRate, 90.0, 0.707)   // 24 dB/oktaf
    private val lp = Biquad.lowPass(sampleRate, 9000.0, 0.707)
    private val presence = Biquad.peaking(sampleRate, 3000.0, 1.0, 4.0)

    private val block = sampleRate / 100 // 10 ms
    private val tmp = FloatArray(block)

    private var noiseFloor = 0.003f
    private var gateGain = 1f
    private var agcGain = 2f
    private var lastGain = 2f

    private val gateFloor = 0.2f       // -14 dB saat hening
    private val targetRms = 0.08f      // ~ -22 dBFS
    private val maxAgc = 10f           // +20 dB maks
    private val minAgc = 0.5f

    fun process(buf: ShortArray, n: Int) {
        var off = 0
        while (off < n) {
            val len = min(block, n - off)
            processBlock(buf, off, len)
            off += len
        }
    }

    private fun processBlock(buf: ShortArray, off: Int, len: Int) {
        var sum = 0f
        for (i in 0 until len) {
            var x = buf[off + i] / 32768f
            x = hp1.process(x)
            x = hp2.process(x)
            x = lp.process(x)
            x = presence.process(x)
            tmp[i] = x
            sum += x * x
        }
        val rms = sqrt(sum / len)

        // Estimasi noise floor: turun cepat, naik pelan (minimum tracking)
        noiseFloor = if (rms < noiseFloor) noiseFloor * 0.9f + rms * 0.1f else noiseFloor * 1.002f
        noiseFloor = noiseFloor.coerceIn(0.00005f, 0.05f)

        val snr = rms / noiseFloor
        val gateTarget = when {
            snr >= 4f -> 1f
            snr <= 1.6f -> gateFloor
            else -> gateFloor + (1f - gateFloor) * ((snr - 1.6f) / 2.4f)
        }
        gateGain += if (gateTarget > gateGain) (gateTarget - gateGain) * 0.6f else (gateTarget - gateGain) * 0.05f

        // AGC hanya menyesuaikan saat ada suara (bukan saat hening) agar noise tidak ikut dikuatkan
        if (snr >= 3f) {
            val desired = (targetRms / max(rms, 0.0001f)).coerceIn(minAgc, maxAgc)
            agcGain += if (desired < agcGain) (desired - agcGain) * 0.3f else (desired - agcGain) * 0.01f
        }

        val g = gateGain * agcGain
        for (i in 0 until len) {
            val gi = lastGain + (g - lastGain) * (i + 1) / len
            var y = tmp[i] * gi
            val a = abs(y)
            if (a > 0.7f) {
                val s = if (y > 0) 1f else -1f
                y = s * (0.7f + 0.3f * tanh((a - 0.7f) / 0.3f))
            }
            buf[off + i] = (y * 32767f).toInt().coerceIn(-32768, 32767).toShort()
        }
        lastGain = g
    }
}
