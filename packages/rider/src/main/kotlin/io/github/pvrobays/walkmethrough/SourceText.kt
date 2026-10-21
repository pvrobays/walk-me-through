package io.github.pvrobays.walkmethrough

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest

object SourceText {
    fun normalize(text: String): String = text.removePrefix("\ufeff").replace("\r\n", "\n").replace('\r', '\n')
    fun decode(bytes: ByteArray): String {
        require(bytes.none { it == 0.toByte() }) { "Binary file: NUL bytes are not supported." }
        return normalize(Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString())
    }
    fun hash(text: String): String = MessageDigest.getInstance("SHA-256").digest(normalize(text).toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it.toInt() and 255) }

    fun occurrences(text: String, needle: String): List<Int> {
        if (needle.isEmpty()) return emptyList()
        val result = mutableListOf<Int>()
        var offset = text.indexOf(needle)
        while (offset >= 0) { result.add(offset); offset = text.indexOf(needle, offset + 1) }
        return result
    }

    fun position(text: String, offset: Int): Position {
        require(offset in 0..text.length) { "Offset outside text." }
        var line = 0L; var lineStart = 0
        for (i in 0 until offset) if (text[i] == '\n') { line++; lineStart = i + 1 }
        return Position(line, (offset - lineStart).toLong())
    }
    fun offset(text: String, position: Position): Int {
        val lines = text.split('\n')
        require(position.line >= 0 && position.line < lines.size && position.character >= 0 &&
            position.character <= lines[position.line.toInt()].length) { "Position outside text." }
        return lines.take(position.line.toInt()).sumOf { it.length + 1 } + position.character.toInt()
    }

    /** For current document snapshots whose normalization removes BOM/CR characters. */
    fun snapshot(text: String): NormalizedSnapshot {
        val normalized = StringBuilder()
        val offsets = mutableListOf<Int>()
        var i = if (text.startsWith('\ufeff')) 1 else 0
        offsets.add(i)
        while (i < text.length) {
            val c = text[i++]
            if (c == '\r') { if (i < text.length && text[i] == '\n') i++; normalized.append('\n') }
            else normalized.append(c)
            offsets.add(i)
        }
        return NormalizedSnapshot(normalized.toString(), offsets.toIntArray())
    }
}
data class NormalizedSnapshot(val text: String, val editorOffsets: IntArray) {
    fun editorOffset(position: Position): Int = editorOffsets[SourceText.offset(text, position)]
}

data class Resolution(val state: String, val range: SourceRange? = null, val reason: String? = null,
    val tie: Boolean? = null, val candidateCount: Int)

object AnchorResolver {
    fun resolve(anchor: Anchor, range: SourceRange, currentText: String?, unreadable: Boolean = false): Resolution {
        if (unreadable || currentText?.contains('\u0000') == true) return Resolution("stale", reason = "unreadable", candidateCount = 0)
        if (currentText == null) return Resolution("stale", reason = "file-missing", candidateCount = 0)
        val text = SourceText.normalize(currentText)
        val lines = text.split('\n')
        val context = anchor.context
        if (context.startLine + context.lineCount <= lines.size &&
            SourceText.hash(lines.subList(context.startLine.toInt(), context.startLine.toInt() + context.lineCount).joinToString("\n")) == context.hash) {
            return Resolution("exact", range, candidateCount = 1)
        }
        val matches = SourceText.occurrences(text, anchor.selectionText)
        val contexts = matches.filter { offset ->
            val start = offset - anchor.selectionInContext.start
            val end = start.toLong() + context.length
            start >= 0 && end <= text.length && (start == 0 || text[start - 1] == '\n') &&
                (end == text.length.toLong() || text[end.toInt()] == '\n') && SourceText.hash(text.substring(start, end.toInt())) == context.hash
        }
        val candidates = contexts.ifEmpty { matches }
        if (candidates.isEmpty()) return Resolution("stale", reason = "not-found", candidateCount = 0)
        data class Candidate(val offset: Int, val start: Position, val lineDistance: Long, val characterDistance: Long)
        val ranked = candidates.map { offset ->
            val start = SourceText.position(text, offset)
            Candidate(offset, start, kotlin.math.abs(start.line - range.start.line), kotlin.math.abs(start.character - range.start.character))
        }.sortedWith(compareBy(Candidate::lineDistance, Candidate::characterDistance, Candidate::offset))
        val best = ranked.first(); val second = ranked.getOrNull(1)
        val tie = second != null && best.lineDistance == second.lineDistance && best.characterDistance == second.characterDistance
        return Resolution(if (contexts.size == 1) "relocated" else "uncertain",
            SourceRange(best.start, SourceText.position(text, best.offset + anchor.selectionText.length)),
            if (contexts.size == 1) null else if (contexts.size > 1) "multiple-context-matches" else "context-changed",
            if (contexts.size == 1) null else tie, candidates.size)
    }
}
