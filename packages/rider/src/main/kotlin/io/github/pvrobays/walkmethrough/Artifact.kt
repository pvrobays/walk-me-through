package io.github.pvrobays.walkmethrough

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.time.Instant

data class Position(val line: Long, val character: Long) : Comparable<Position> {
    override fun compareTo(other: Position): Int = compareValuesBy(this, other, Position::line, Position::character)
}
data class SourceRange(val start: Position, val end: Position)
data class AnchorContext(val startLine: Long, val lineCount: Int, val length: Int, val hash: String, val unique: Boolean)
data class SelectionOffsets(val start: Int, val end: Int)
data class Anchor(val algorithm: String, val selectionText: String, val context: AnchorContext, val selectionInContext: SelectionOffsets)
data class Location(val path: String, val range: SourceRange, val anchor: Anchor)
data class Step(val id: String, val parentId: String?, val title: String, val explanation: String, val evidence: String?, val location: Location?)
/** Retain the complete validated JSON, including unknown fields and all generator/source metadata. */
data class Artifact(val raw: JsonObject, val steps: List<Step>) {
    val id: String get() = raw["id"].asString
    val title: String get() = raw["title"].asString
    val summary: String get() = raw["summary"].asString
    val createdAt: String get() = raw["createdAt"].asString
    val recordedRoot: String get() = raw["project"].asJsonObject["root"].asString
}
data class ArtifactProblem(val path: String, val message: String, val code: String = "INVALID_ARTIFACT",
    val hint: String = "Correct the named field or type before retrying.", val recovery: String = "fix-input")
data class ArtifactValidation(val value: Artifact?, val errors: List<ArtifactProblem>) { val ok get() = errors.isEmpty() }
class InvalidArtifactException(val artifactPath: String, val problems: List<ArtifactProblem>) :
    IllegalArgumentException("$artifactPath: " + problems.joinToString("; ") { "${it.path}: ${it.message}" })

internal fun JsonElement?.obj(): JsonObject? = if (this?.isJsonObject == true) asJsonObject else null
internal fun JsonElement?.text(): String? = if (this?.isJsonPrimitive == true && asJsonPrimitive.isString) asString else null
internal fun JsonElement?.bool(): Boolean? = if (this?.isJsonPrimitive == true && asJsonPrimitive.isBoolean) asBoolean else null
private fun JsonElement?.integer(min: Int = 0): Boolean = this?.isJsonPrimitive == true && asJsonPrimitive.isNumber &&
    runCatching { asDouble.let { it.isFinite() && it >= min && it <= 9007199254740991.0 && it % 1.0 == 0.0 } }.getOrDefault(false)
private fun JsonElement?.validText(max: Int): Boolean = text()?.let { jsTrim(it).isNotEmpty() && it.length <= max } ?: false
// ECMAScript trim includes BOM/NBSP but excludes U+0085, unlike several JVM whitespace helpers.
internal fun jsTrim(value: String): String = value.trim { it in "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff" }
fun isRelativeSourcePath(value: String): Boolean = value.isNotEmpty() && !value.startsWith('/') &&
    value.none { it == '\\' || it == '\u0000' || it == ':' } && value.split('/').all { it.isNotEmpty() && it != "." && it != ".." }

object ArtifactReader {
    fun read(json: String, artifactPath: String): Artifact {
        val parsed = try { JsonParser.parseString(json) } catch (e: RuntimeException) {
            throw InvalidArtifactException(artifactPath, listOf(ArtifactProblem("$", "Invalid JSON: ${e.message}")))
        }
        val result = validate(parsed)
        return result.value ?: throw InvalidArtifactException(artifactPath, result.errors)
    }

    fun validate(value: JsonElement): ArtifactValidation {
        val errors = mutableListOf<ArtifactProblem>()
        fun add(path: String, message: String) { errors.add(ArtifactProblem(path, message)) }
        val a = value.obj() ?: return ArtifactValidation(null, listOf(ArtifactProblem("$", "Expected an artifact object.")))
        if (!a["schemaVersion"].integer() || a["schemaVersion"].asDouble != 1.0) add("schemaVersion", "Unsupported schemaVersion. Update the viewer to read this walkthrough.")
        val generator = a["generator"].obj()
        if (generator?.get("name").text() != "walk-me-through" || generator?.get("bundleVersion").text()?.matches(Regex("^\\d+\\.\\d+\\.\\d+(?:[-+][\\w.-]+)?$")) != true) add("generator", "Expected generator name and semantic bundle version.")
        if (a["id"].text()?.matches(Regex("^\\d{8}T\\d{9}Z-[a-z2-7]{6}$")) != true) add("id", "Expected a timestamp and six lowercase base32 characters.")
        val timestamp = a["createdAt"].text()
        if (timestamp == null || !timestamp.matches(Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$")) || !runCatching {
                java.time.format.DateTimeFormatterBuilder().appendInstant(3).toFormatter().format(Instant.parse(timestamp)) == timestamp
            }.getOrDefault(false)) add("createdAt", "Expected an ISO-8601 UTC millisecond timestamp.")
        if (!a["title"].validText(200)) add("title", "Title must contain 1–200 characters.")
        if (!a["summary"].validText(10000)) add("summary", "Summary must contain 1–10000 characters.")
        val project = a["project"].obj()
        if (project?.get("root").text()?.let { Regex("^(?:/|[A-Za-z]:[\\\\/]|\\\\\\\\)").containsMatchIn(it) } != true) add("project.root", "Expected an absolute project root.")
        val env = project?.get("environment").obj()
        if (!env?.get("kind").validText(100) || !env?.get("platform").validText(100) || env?.get("unsupportedOverride").bool() == null) add("project.environment", "Expected environment kind, platform, and unsupportedOverride.")
        val source = a["source"].obj()
        val git = source?.get("git")
        if (source == null || git == null || (!git.isJsonNull && (git.obj()?.get("commit").text()?.matches(Regex("^[a-f0-9]{7,64}$", RegexOption.IGNORE_CASE)) != true || git.obj()?.get("dirty").bool() == null))) add("source.git", "Expected git commit and dirty flag, or null.")
        val steps = a["steps"]?.takeIf { it.isJsonArray }?.asJsonArray
        if (steps == null || steps.size() !in 1..200) add("steps", "Expected 1–200 steps.")
        val seen = mutableMapOf<String, Int>()
        val depths = mutableMapOf<String, Int>()
        var ancestry = mutableListOf<String>()
        val parentIds = steps?.mapNotNull { it.obj()?.get("parentId").text() }?.toSet() ?: emptySet()
        steps?.forEachIndexed { i, item ->
            val p = "steps[$i]"
            val step = item.obj()
            if (step == null) { add(p, "Expected a step object."); return@forEachIndexed }
            val id = step["id"].text()
            if (!step["id"].validText(200)) add("$p.id", "Expected a nonempty step ID.")
            else { if (seen.containsKey(id)) add("$p.id", "Duplicate step ID."); seen[id!!] = i }
            val parentValue = step["parentId"]
            val parent = parentValue.text()
            var depth = 1
            if (parentValue != null && !parentValue.isJsonNull) {
                if (parent == null || seen[parent] == null || seen.getValue(parent) >= i) add("$p.parentId", "Parent must refer to an earlier step; missing, forward, and cyclic parents are invalid.")
                else {
                    depth = (depths[parent] ?: 1) + 1
                    if (parent !in ancestry) add("$p.parentId", "Steps must be in depth-first pre-order.")
                    ancestry = ancestry.take(ancestry.indexOf(parent) + 1).toMutableList()
                }
            } else ancestry.clear()
            if (depth > 4) add(p, "Step exceeds maximum depth 4.")
            if (id != null) { depths[id] = depth; ancestry.add(id) }
            if (!step["title"].validText(200)) add("$p.title", "Expected title within 200 characters.")
            if (!step["explanation"].validText(20000)) add("$p.explanation", "Expected explanation within 20000 characters.")
            if (step.has("evidence") && step["evidence"].text() !in setOf("observation", "hypothesis", "conclusion")) add("$p.evidence", "Expected observation, hypothesis, or conclusion.")
            if (!step.has("location")) {
                if (parentValue != null && !parentValue.isJsonNull && id !in parentIds) add("$p.location", "Nested leaf steps require a source location.")
            } else validateLocation(step["location"], "$p.location", errors)
        }
        if (errors.isNotEmpty()) return ArtifactValidation(null, errors)
        val copy = a.deepCopy()
        return ArtifactValidation(Artifact(copy, copy["steps"].asJsonArray.map { item ->
            val s = item.asJsonObject
            Step(s["id"].asString, s["parentId"].text(), s["title"].asString, s["explanation"].asString, s["evidence"].text(),
                s["location"]?.let { parseLocation(it.asJsonObject) })
        }), emptyList())
    }

    private fun validateLocation(value: JsonElement, path: String, errors: MutableList<ArtifactProblem>) {
        fun add(field: String, message: String) { errors.add(ArtifactProblem(path + field, message)) }
        val loc = value.obj() ?: run { add("", "Expected a location object."); return }
        if (loc["path"].text()?.let(::isRelativeSourcePath) != true) add(".path", "Expected a project-relative forward-slash path without escaping segments.")
        val range = loc["range"].obj()
        val start = range?.get("start").obj(); val end = range?.get("end").obj()
        val rangeValid = start != null && end != null && listOf(start["line"], start["character"], end["line"], end["character"]).all { it.integer() }
        if (!rangeValid) add(".range", "Expected nonnegative integer line and character positions.")
        else if (start!!["line"].asDouble > end!!["line"].asDouble || (start["line"].asDouble == end["line"].asDouble && start["character"].asDouble >= end["character"].asDouble)) add(".range", "Range must be nonempty and end after its start.")
        val anchor = loc["anchor"].obj() ?: run { add(".anchor", "Expected captured anchor metadata."); return }
        if (anchor["algorithm"].text() != "sha256-lf-v1") add(".anchor.algorithm", "Unsupported anchor algorithm.")
        val text = anchor["selectionText"].text()
        if (text == null || jsTrim(text).isEmpty() || text.any { it == '\r' || it == '\u0000' } || text.length > 2097152) add(".anchor.selectionText", "Expected nonempty, normalized selection text within the source size limit.")
        val context = anchor["context"].obj()
        val contextValid = context != null && context["startLine"].integer() && context["lineCount"].integer(1) && context["lineCount"].asDouble <= 320 && context["length"].integer(1) && context["length"].asDouble <= 2097152 && context["hash"].text()?.matches(Regex("^[a-f0-9]{64}$")) == true && context["unique"].bool() != null
        if (!contextValid) add(".anchor.context", "Expected bounded context line span, UTF-16 length, SHA-256 hash, and unique flag.")
        val selection = anchor["selectionInContext"].obj()
        val selectionValid = selection != null && selection["start"].integer() && selection["end"].integer(1) && selection["end"].asDouble > selection["start"].asDouble && text != null && selection["end"].asDouble - selection["start"].asDouble == text.length.toDouble()
        if (!selectionValid || (contextValid && selectionValid && selection!!["end"].asDouble > context!!["length"].asDouble)) add(".anchor.selectionInContext", "Selection offsets must fit context and match the selected text length.")
        if (rangeValid && contextValid) {
            val sl = start!!["line"].asDouble; val el = end!!["line"].asDouble
            if (el - sl + 1 > 300 || sl < context!!["startLine"].asDouble || el >= context["startLine"].asDouble + context["lineCount"].asDouble) add(".range", "Range must fit captured context and the location span limit.")
            if (text != null) {
                val lines = text.split('\n')
                val expectedEnd = if (lines.size == 1) start["character"].asDouble + lines[0].length else lines.last().length.toDouble()
                if (el != sl + lines.size - 1 || end["character"].asDouble != expectedEnd) add(".range", "Range dimensions must match selection text.")
            }
        }
    }

    private fun parseLocation(loc: JsonObject): Location {
        fun position(p: JsonObject) = Position(p["line"].asDouble.toLong(), p["character"].asDouble.toLong())
        val r = loc["range"].asJsonObject; val a = loc["anchor"].asJsonObject
        val c = a["context"].asJsonObject; val s = a["selectionInContext"].asJsonObject
        return Location(loc["path"].asString, SourceRange(position(r["start"].asJsonObject), position(r["end"].asJsonObject)),
            Anchor(a["algorithm"].asString, a["selectionText"].asString, AnchorContext(c["startLine"].asDouble.toLong(), c["lineCount"].asInt, c["length"].asInt, c["hash"].asString, c["unique"].asBoolean), SelectionOffsets(s["start"].asInt, s["end"].asInt)))
    }
}
