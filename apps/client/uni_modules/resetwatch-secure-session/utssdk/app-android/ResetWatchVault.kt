package uts.sdk.modules.resetwatchSecureSession

import android.app.KeyguardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.util.Base64
import java.io.File
import java.io.FileOutputStream
import java.security.KeyStore
import java.security.MessageDigest
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/** App-private, no-backup ciphertext; non-exportable per-origin AndroidKeyStore keys. */
object ResetWatchVault {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val tokenPattern = Regex("^rw_[a-f0-9]{64}$")
    private val originPattern = Regex("^https://[a-z0-9.-]+(?::[0-9]{1,5})?$")

    @JvmStatic fun execute(context: Context, operation: String, origin: String,
                           value: String, callback: (String) -> Unit) {
        worker.execute {
            val result = try { perform(context.applicationContext, operation, origin, value) }
                         catch (_: Exception) { failure("unreadable") }
            main.post { callback(result) }
        }
    }

    /** Public for SDK tests; production calls this only on the serial worker. */
    @JvmStatic fun perform(context: Context, operation: String, origin: String, value: String): String {
        if (!originPattern.matches(origin) || origin.length > 280) return failure("invalid_origin")
        if (operation !in setOf("read", "write", "remove")) return failure("invalid_operation")
        val suffix = MessageDigest.getInstance("SHA-256").digest(origin.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        val alias = "resetwatch.session.v1." + suffix
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val dir = File(context.noBackupFilesDir, "resetwatch-vault-v1")
        val file = AtomicFile(File(dir, suffix + ".json"))
        if (operation == "remove") {
            // Destroying the key first makes old ciphertext unusable even if deletion fails.
            if (store.containsAlias(alias)) store.deleteEntry(alias)
            file.delete()
            return success("")
        }
        val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (keyguard.isDeviceLocked) return failure("locked")
        if (operation == "read") {
            if (!file.baseFile.exists()) return success("")
            if (file.baseFile.length() > 4096 || !store.containsAlias(alias)) return failure("unreadable")
            val envelope = JSONObject(file.openRead().use { it.readBytes().toString(Charsets.UTF_8) })
            if (envelope.optInt("version") != 1) return failure("unreadable")
            val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
            if (iv.size != 12) return failure("unreadable")
            val bytes = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, store.getKey(alias, null), GCMParameterSpec(128, iv))
            cipher.updateAAD(origin.toByteArray(Charsets.UTF_8))
            val plaintext = cipher.doFinal(bytes)
            val credential = plaintext.toString(Charsets.UTF_8)
            plaintext.fill(0)
            return if (tokenPattern.matches(credential)) success(credential) else failure("unreadable")
        }
        if (!tokenPattern.matches(value)) return failure("invalid_token")
        if (!dir.exists() && !dir.mkdirs()) return failure("unreadable")
        val key = if (store.containsAlias(alias)) store.getKey(alias, null) as SecretKey else {
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
            generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
            generator.generateKey()
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key) // Provider-generated random IV for every write.
        cipher.updateAAD(origin.toByteArray(Charsets.UTF_8))
        val plaintext = value.toByteArray(Charsets.UTF_8)
        val encrypted = try { cipher.doFinal(plaintext) } finally { plaintext.fill(0) }
        val envelope = JSONObject().put("version", 1)
            .put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP)).toString()
        var stream: FileOutputStream? = null
        try {
            stream = file.startWrite()
            stream.write(envelope.toByteArray(Charsets.UTF_8))
            file.finishWrite(stream)
        } catch (error: Exception) { file.failWrite(stream); throw error }
        return success("")
    }
    private fun success(value: String) = JSONObject().put("ok", true).put("value", value).toString()
    private fun failure(code: String) = JSONObject().put("ok", false).put("code", code).toString()
}
