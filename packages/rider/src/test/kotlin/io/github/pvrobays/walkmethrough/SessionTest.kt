package io.github.pvrobays.walkmethrough

import com.google.gson.Gson
import com.google.gson.JsonObject
import org.junit.Assert.*
import org.junit.Test
import java.nio.file.Path

class SessionTest {
    @Test fun `real session navigation and availability match shared four level traces`() {
        val fixtures = conformance()["navigation"].asJsonObject
        val artifact = ArtifactReader.read(fixtures["artifact"].toString(), "fixture.json")
        for (item in fixtures["cases"].asJsonArray) {
            val c = item.asJsonObject; val session = WalkthroughSession()
            c["actions"].asJsonArray.forEachIndexed { i, action ->
                when (val a = action.asString) {
                    "open" -> session.open(artifact, Path.of("."))
                    "close" -> session.close()
                    "next" -> session.next()
                    "previous" -> session.previous()
                    "skip" -> session.skipDetails()
                    "return" -> session.refresh()
                    else -> session.select(a.removePrefix("select:"))
                }
                val actual = JsonObject().apply {
                    addProperty("active", session.active); addProperty("index", session.index)
                    addProperty("current", if (session.active) session.current?.id ?: "overview" else null)
                    addProperty("previous", session.hasPrevious); addProperty("next", session.hasNext)
                    addProperty("skip", session.skipTarget?.id)
                }
                assertEquals("${c["name"]} action $i", c["expected"].asJsonArray[i], actual)
            }
            session.dispose()
        }
    }

    @Test fun `invalid replacement preserves current session and projects are independent`() {
        val artifact = ArtifactReader.read(conformance()["navigation"].asJsonObject["artifact"].toString(), "fixture.json")
        val a = WalkthroughSession(); val b = WalkthroughSession()
        a.open(artifact, Path.of("a")); b.open(artifact, Path.of("b"))
        a.select("a111")
        val generation = a.generation
        assertThrows(InvalidArtifactException::class.java) { a.openJson("{}", "invalid.json", Path.of("c")) }
        assertSame(artifact, a.artifact)
        assertEquals("a111", a.current!!.id)
        assertEquals(generation, a.generation)
        a.dispose()
        assertTrue(b.active)
        assertEquals(0, b.index)
        b.dispose()
    }
}
