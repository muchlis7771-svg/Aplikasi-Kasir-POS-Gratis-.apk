package com.jdata.jkam

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.GridLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import java.text.DecimalFormat

/**
 * Layar pembuka berupa kalkulator sederhana yang berfungsi penuh.
 * Ketik 0000 lalu tekan "=" untuk membuka halaman login JKam (kunci privasi aplikasi).
 * Catatan: ini hanya menyembunyikan halaman login — saat merekam, notifikasi JKam
 * dan indikator mikrofon Android tetap tampil dan tidak bisa disembunyikan.
 */
class CalculatorActivity : AppCompatActivity() {

    private lateinit var screen: TextView
    private lateinit var exprView: TextView
    private var entry = "0"          // angka yang sedang diketik (apa adanya)
    private var acc = 0.0            // akumulator
    private var pendingOp: String? = null
    private var freshEntry = true    // ketukan digit berikutnya memulai angka baru
    private var exprText = ""
    private val fmt = DecimalFormat("#.##########")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#F4F6FB")
        window.navigationBarColor = Color.parseColor("#F4F6FB")
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true; isAppearanceLightNavigationBars = true
        }
        setContentView(R.layout.activity_calc)
        screen = findViewById(R.id.screen)
        exprView = findViewById(R.id.expr)
        buildPad(findViewById(R.id.pad))
    }

    private val keys = listOf(
        "C" to "fn", "⌫" to "fn", "%" to "fn", "÷" to "op",
        "7" to "d", "8" to "d", "9" to "d", "×" to "op",
        "4" to "d", "5" to "d", "6" to "d", "−" to "op",
        "1" to "d", "2" to "d", "3" to "d", "+" to "op",
        "0" to "d0", "." to "d", "=" to "eq",
    )

    private fun buildPad(pad: GridLayout) {
        val dp = resources.displayMetrics.density
        val gap = (6 * dp).toInt()
        val h = (66 * dp).toInt()
        pad.columnCount = 4
        for ((label, kind) in keys) {
            val b = TextView(this).apply {
                text = label
                gravity = Gravity.CENTER
                setTextSize(TypedValue.COMPLEX_UNIT_SP, if (kind == "op" || kind == "eq") 26f else 24f)
                typeface = Typeface.DEFAULT_BOLD
                isClickable = true
                isFocusable = true
                when (kind) {
                    "eq" -> { setBackgroundResource(R.drawable.bg_grad); setTextColor(Color.WHITE) }
                    "op" -> { setBackgroundResource(R.drawable.bg_tint); setTextColor(Color.parseColor("#6D28D9")) }
                    "fn" -> { setBackgroundResource(R.drawable.bg_input); setTextColor(Color.parseColor("#64748B")) }
                    else -> { setBackgroundResource(R.drawable.bg_card); setTextColor(Color.parseColor("#0F172A")) }
                }
                setOnClickListener { onKey(label) }
            }
            val span = if (kind == "d0") 2 else 1
            val lp = GridLayout.LayoutParams().apply {
                width = 0; height = h
                columnSpec = GridLayout.spec(GridLayout.UNDEFINED, span, GridLayout.FILL, span.toFloat())
                rowSpec = GridLayout.spec(GridLayout.UNDEFINED, GridLayout.FILL, 1f)
                setMargins(gap / 2, gap / 2, gap / 2, gap / 2)
            }
            pad.addView(b, lp)
        }
    }

    private fun onKey(k: String) {
        when (k) {
            "C" -> { entry = "0"; acc = 0.0; pendingOp = null; freshEntry = true; exprText = "" }
            "⌫" -> {
                if (freshEntry) entry = "0"
                else { entry = if (entry.length > 1) entry.dropLast(1) else "0"; if (entry.isEmpty()) entry = "0" }
            }
            "." -> { if (freshEntry) { entry = "0."; freshEntry = false } else if (!entry.contains(".")) entry += "." }
            "%" -> { entry = fmt.format(parse(entry) / 100); freshEntry = true }
            "+", "−", "×", "÷" -> applyOp(k)
            "=" -> equals()
            else -> { // digit
                if (freshEntry) { entry = k; freshEntry = false }
                else if (entry.length < 12) { entry = if (entry == "0") k else entry + k }
            }
        }
        render()
    }

    private fun applyOp(op: String) {
        if (pendingOp != null && !freshEntry) compute()
        else acc = parse(entry)
        pendingOp = op
        exprText = trim(acc) + " " + op
        freshEntry = true
    }

    private fun equals() {
        // Pintu rahasia: ketik persis 0000 lalu "=" tanpa operator -> buka login
        if (pendingOp == null && entry == "0000") { openGate(); return }
        if (pendingOp != null) {
            compute()
            pendingOp = null
            exprText = ""
            freshEntry = true
        }
    }

    private fun compute() {
        val b = parse(entry)
        acc = when (pendingOp) {
            "+" -> acc + b; "−" -> acc - b; "×" -> acc * b
            "÷" -> if (b == 0.0) Double.NaN else acc / b
            else -> b
        }
        entry = if (acc.isNaN()) "Error" else trim(acc)
    }

    private fun parse(s: String) = s.toDoubleOrNull() ?: 0.0
    private fun trim(d: Double) = if (d.isNaN()) "Error" else fmt.format(d)

    private fun render() {
        screen.text = entry
        exprView.text = exprText
    }

    private fun openGate() {
        entry = "0"; freshEntry = true; render()
        val p = Prefs(this)
        startActivity(Intent(this, if (p.loggedIn) MainActivity::class.java else LoginActivity::class.java))
    }

    override fun onResume() {
        super.onResume()
        // Kembali ke tampilan kalkulator bersih setelah keluar dari login/rekam
        entry = "0"; acc = 0.0; pendingOp = null; freshEntry = true; exprText = ""
        if (::screen.isInitialized) render()
    }
}
