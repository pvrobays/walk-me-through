package io.github.pvrobays.walkmethrough

import com.google.gson.Gson
import com.google.gson.JsonParser
import org.junit.Assert.*
import org.junit.Test

internal fun conformance() = JsonParser.parseString(ArtifactTest::class.java.getResource("/v1.json")!!.readText()).asJsonObject

class ArtifactTest {
    @Test fun `acceptance and field errors match all shared validation cases`() {
        for (case in conformance()["validation"].asJsonArray) {
            val c = case.asJsonObject
            val actual = ArtifactReader.validate(c["input"])
            val expected = c["expected"].asJsonObject
            assertEquals(c["name"].asString, expected["ok"].asBoolean, actual.ok)
            assertEquals(c["name"].asString, expected["errors"], Gson().toJsonTree(actual.errors))
            if (actual.ok) assertEquals(c["input"], actual.value!!.raw)
        }
    }

    @Test fun `errors name artifact and fields without yielding partial artifact`() {
        try {
            ArtifactReader.read("{}", "C:/project/.walk-me-through/walkthroughs/bad.json")
            fail("Expected failure")
        } catch (e: InvalidArtifactException) {
            assertTrue(e.message!!.contains("bad.json"))
            assertTrue(e.message!!.contains("schemaVersion"))
        }
        assertNull(ArtifactReader.validate(JsonParser.parseString("{}" )).value)
    }

    @Test fun `models retain evidence generator and unknown metadata`() {
        val cases = conformance()["validation"].asJsonArray.map { it.asJsonObject }
        val input = cases.first { it["name"].asString == "four-levels-evidence" }["input"]
        val a = ArtifactReader.read(input.toString(), "fixture.json")
        assertEquals(listOf("observation", "observation", "observation", "hypothesis", "conclusion"), a.steps.map { it.evidence })
        assertEquals("0.1.0", a.raw["generator"].asJsonObject["bundleVersion"].asString)
        val unknown = cases.first { it["name"].asString == "unknown-fields-accepted" }["input"]
        assertEquals(unknown, ArtifactReader.read(unknown.toString(), "unknown.json").raw)
    }
}
