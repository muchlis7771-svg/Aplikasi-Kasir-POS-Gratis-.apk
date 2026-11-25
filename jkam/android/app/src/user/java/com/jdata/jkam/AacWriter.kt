package com.jdata.jkam

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteOrder

/** Encode PCM 16-bit mono ke AAC-LC (.m4a) dengan MediaCodec + MediaMuxer. */
class AacWriter(val file: File, private val sampleRate: Int, bitRate: Int) {

    private val codec: MediaCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    private val muxer = MediaMuxer(file.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    private val info = MediaCodec.BufferInfo()
    private var track = -1
    private var muxerStarted = false
    private var samplesIn = 0L
    private var wroteData = false

    init {
        val fmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, 1).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
        }
        codec.configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
    }

    fun write(pcm: ShortArray, n: Int) {
        var off = 0
        while (off < n) {
            val idx = codec.dequeueInputBuffer(10_000)
            if (idx >= 0) {
                val ib = codec.getInputBuffer(idx)!!
                ib.clear()
                ib.order(ByteOrder.nativeOrder())
                val count = minOf(n - off, ib.capacity() / 2)
                ib.asShortBuffer().put(pcm, off, count)
                val pts = samplesIn * 1_000_000L / sampleRate
                codec.queueInputBuffer(idx, 0, count * 2, pts, 0)
                samplesIn += count
                off += count
            }
            drain(false)
        }
    }

    private fun drain(eos: Boolean) {
        while (true) {
            val idx = codec.dequeueOutputBuffer(info, if (eos) 10_000 else 0)
            when {
                idx == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!eos) return
                idx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    track = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
                idx >= 0 -> {
                    val ob = codec.getOutputBuffer(idx)!!
                    if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
                    if (info.size > 0 && muxerStarted) {
                        ob.position(info.offset)
                        ob.limit(info.offset + info.size)
                        muxer.writeSampleData(track, ob, info)
                        wroteData = true
                    }
                    codec.releaseOutputBuffer(idx, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                }
            }
        }
    }

    /** Tutup file. Mengembalikan true bila file berisi audio. */
    fun finish(): Boolean {
        try {
            var queued = false
            var tries = 0
            while (!queued && tries++ < 100) {
                val idx = codec.dequeueInputBuffer(10_000)
                if (idx >= 0) {
                    codec.queueInputBuffer(idx, 0, 0, samplesIn * 1_000_000L / sampleRate, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                    queued = true
                } else drain(false)
            }
            if (queued) drain(true)
        } catch (_: Exception) {
        }
        try { codec.stop() } catch (_: Exception) {}
        codec.release()
        try { if (muxerStarted) muxer.stop() } catch (_: Exception) {}
        try { muxer.release() } catch (_: Exception) {}
        if (!wroteData) file.delete()
        return wroteData
    }

    val durationMs: Long get() = samplesIn * 1000L / sampleRate
}
