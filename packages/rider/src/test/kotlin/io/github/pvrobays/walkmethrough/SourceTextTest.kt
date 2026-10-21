package io.github.pvrobays.walkmethrough

import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

class SourceTextTest {
    @Test fun `independent resolver asserts exact relocation uncertainty tie and stale without old range`() {
        val range = SourceRange(Position(1, 0), Position(1, 1))
        val anchor = Anchor("sha256-lf-v1", "x", AnchorContext(1, 1, 1, SourceText.hash("x"), true), SelectionOffsets(0, 1))
        assertEquals("exact", AnchorResolver.resolve(anchor, range, "a\nx").state)
        assertEquals("relocated", AnchorResolver.resolve(anchor, range, "a\nb\nx").state)
        val tie = AnchorResolver.resolve(anchor, range, "x\na\nx")
        assertEquals("uncertain", tie.state)
        assertEquals(true, tie.tie)
        assertEquals(Position(0, 0), tie.range!!.start)
        val lost = AnchorResolver.resolve(anchor, range, "changed(x)")
        assertEquals("context-changed", lost.reason)
        assertEquals("uncertain", lost.state)
        assertNull(AnchorResolver.resolve(anchor, range, "gone").range)
    }

    @Test fun `all normalized coordinates hashes and overlaps match reference fixtures`() {
        for (item in conformance()["coordinates"].asJsonArray) {
            val c = item.asJsonObject; val original = c["original"].asString
            val text = SourceText.normalize(original)
            assertEquals(c["normalized"].asString, text)
            assertEquals(c["hash"].asString, SourceText.hash(original))
            for (entry in c["positions"].asJsonArray) {
                val p = entry.asJsonObject
                val expected = Gson().fromJson(p["position"], Position::class.java)
                assertEquals(expected, SourceText.position(text, p["offset"].asInt))
                assertEquals(p["offset"].asInt, SourceText.offset(text, expected))
            }
            val occurrence = c["occurrences"].asJsonObject
            assertEquals(occurrence["offsets"], Gson().toJsonTree(SourceText.occurrences(text, occurrence["needle"].asString)))
        }
    }

    @Test fun `every resolver result matches shared context first fixtures`() {
        for (item in conformance()["resolutions"].asJsonArray) {
            val c = item.asJsonObject; val gson = Gson()
            val current = c["current"]
            val actual = AnchorResolver.resolve(gson.fromJson(c["anchor"], Anchor::class.java),
                gson.fromJson(c["range"], SourceRange::class.java), if (current.isJsonPrimitive) current.asString else null,
                current.isJsonObject)
            assertEquals(c["name"].asString, c["expected"], gson.toJsonTree(actual))
        }
    }

    @Test fun `snapshot maps BOM CRLF tabs supplementary characters and exclusive ends`() {
        val snapshot = SourceText.snapshot("\ufeff\t😀x\r\ny\rz\n")
        assertEquals("\t😀x\ny\nz\n", snapshot.text)
        assertEquals(2, snapshot.editorOffset(Position(0, 1)))
        assertEquals(5, snapshot.editorOffset(Position(0, 4)))
        assertEquals(7, snapshot.editorOffset(Position(1, 0)))
        assertEquals(11, snapshot.editorOffset(Position(3, 0)))
        assertEquals(listOf(0, 1, 2), SourceText.occurrences("aaaa", "aa"))
        assertEquals(emptyList<Int>(), SourceText.occurrences("aaaa", ""))
    }

    @Test fun `strict disk decoding rejects invalid UTF8 and binary data`() {
        for (bytes in listOf(byteArrayOf(0), byteArrayOf(0xc3.toByte(), 0x28))) {
            assertThrows(Exception::class.java) { SourceText.decode(bytes) }
        }
        assertEquals("x\ny", SourceText.decode("\ufeffx\r\ny".toByteArray()))
        assertThrows(IllegalArgumentException::class.java) { SourceText.offset("x", Position(0, 2)) }
        assertThrows(IllegalArgumentException::class.java) { SourceText.offset("x", Position(Long.MAX_VALUE, 0)) }
    }
}
