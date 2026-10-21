package io.github.pvrobays.walkmethrough

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.Strictness
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import java.io.StringReader
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.util.Base64

/** A validated v1 launch envelope. `title` is display-only and never authoritative. */
data class LaunchEnvelope(val root: String, val kind: String, val platform: String, val id: String, val step: String?, val title: String?) {
    fun toJson(): JsonObject = JsonObject().apply {
        addProperty("v", 1); addProperty("root", root)
        add("env", JsonObject().apply { addProperty("kind", kind); addProperty("platform", platform) })
        addProperty("id", id)
        step?.let { addProperty("step", it) }
        title?.let { addProperty("title", it) }
    }
}
data class LaunchProblem(val path: String, val message: String)
data class LaunchDecode(val envelope: LaunchEnvelope?, val category: String?, val problems: List<LaunchProblem>) {
    val ok get() = envelope != null
}

/** Kotlin port of packages/core/src/launch.ts decoding; verified against tests/conformance/launch-v1.json. */
object LaunchEnvelopes {
    const val MAX_ENCODED = 1536
    const val MAX_TITLE = 120
    const val MAX_STEP = 200
    const val RIDER_PREFIX = "jetbrains://rider/walkmethrough/open?e="

    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    private val members = setOf("v", "root", "env", "id", "step", "title")
    private val envMembers = setOf("kind", "platform")
    private val absolutePath = Regex("^(?:/|[A-Za-z]:[\\\\/]|\\\\\\\\)")
    private val artifactId = Regex("^\\d{8}T\\d{9}Z-[a-z2-7]{6}$")
    private const val VERSION = "Unsupported launch envelope version. Update Walk Me Through to open this link."

    private fun malformed(message: String) = LaunchDecode(null, "malformed", listOf(LaunchProblem("$", message)))

    fun decode(text: String): LaunchDecode {
        if (text.length > MAX_ENCODED) return LaunchDecode(null, "too-long", listOf(LaunchProblem("$", "Launch envelope exceeds $MAX_ENCODED characters.")))
        if (text.isEmpty()) return malformed("Launch envelope is empty.")
        if ('=' in text) return malformed("Launch envelope must not contain base64 padding.")
        if (text.any { it !in ALPHABET }) return malformed("Launch envelope contains characters outside the base64url alphabet.")
        val bytes = try { Base64.getUrlDecoder().decode(text) } catch (_: IllegalArgumentException) { null }
        // Reject non-canonical encodings (nonzero unused trailing bits) the JDK decoder would accept.
        if (bytes == null || Base64.getUrlEncoder().withoutPadding().encodeToString(bytes) != text) return malformed("Launch envelope is not valid unpadded base64url.")
        val json = try {
            Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString()
        } catch (_: CharacterCodingException) { return malformed("Launch envelope is not valid UTF-8.") }
        val parsed = parseStrict(json) ?: return malformed("Launch envelope is not valid JSON.")
        val value = parsed.obj() ?: return malformed("Launch envelope must be a JSON object.")
        return validate(value)
    }

    /** RFC 8259 parsing equivalent to JSON.parse: no comments, single quotes, NaN, trailing commas, BOM or trailing data. */
    private fun parseStrict(json: String): JsonElement? = try {
        // Gson silently skips a leading byte-order mark; JSON.parse rejects it.
        if (json.startsWith('\ufeff')) throw IllegalArgumentException("BOM")
        val reader = JsonReader(StringReader(json)).apply { strictness = Strictness.STRICT }
        val element = JsonParser.parseReader(reader)
        if (reader.peek() != JsonToken.END_DOCUMENT) null else element
    } catch (_: RuntimeException) { null } catch (_: java.io.IOException) { null }

    private fun number(value: JsonElement?): Double? =
        if (value?.isJsonPrimitive == true && value.asJsonPrimitive.isNumber) value.asDouble else null
    private fun nonempty(value: JsonElement?): Boolean = value.text()?.let { jsTrim(it).isNotEmpty() } ?: false

    fun validate(value: JsonObject): LaunchDecode {
        val version = number(value["v"])
        if (value.has("v") && version != null && version != 1.0) return LaunchDecode(null, "unsupported-version", listOf(LaunchProblem("v", VERSION)))
        val problems = mutableListOf<LaunchProblem>()
        fun add(path: String, message: String) { problems.add(LaunchProblem(path, message)) }
        if (version != 1.0) add("v", "Expected version number 1.")
        val root = value["root"].text()
        if (root == null || !absolutePath.containsMatchIn(root)) add("root", "Expected an absolute Windows or POSIX project root.")
        val env = value["env"].obj()
        if (env == null) add("env", "Expected an env object with kind and platform.")
        else {
            if (!nonempty(env["kind"])) add("env.kind", "Expected a nonempty environment kind.")
            if (!nonempty(env["platform"])) add("env.platform", "Expected a nonempty environment platform.")
            for (key in env.keySet().filter { it !in envMembers }.sorted()) add("env.$key", "Unknown member: env.$key.")
        }
        val id = value["id"].text()
        if (id == null || !id.matches(artifactId)) add("id", "Expected an artifact ID: a timestamp and six lowercase base32 characters.")
        val step = value["step"].text()
        if (value.has("step") && (step == null || jsTrim(step).isEmpty() || step.length > MAX_STEP)) add("step", "Expected a nonempty step ID of at most $MAX_STEP characters.")
        val title = value["title"].text()
        if (value.has("title") && (title == null || title.length > MAX_TITLE)) add("title", "Expected a title of at most $MAX_TITLE characters.")
        for (key in value.keySet().filter { it !in members }.sorted()) add(key, "Unknown member: $key.")
        if (problems.isNotEmpty()) return LaunchDecode(null, "invalid", problems)
        return LaunchDecode(LaunchEnvelope(root!!, env!!["kind"].asString, env["platform"].asString, id!!,
            if (value.has("step")) step else null, if (value.has("title")) title else null), null, emptyList())
    }
}
