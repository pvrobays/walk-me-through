package io.github.pvrobays.walkmethrough

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.Assert.*
import org.junit.Test

internal fun launchConformance(): JsonObject =
    JsonParser.parseString(LaunchEnvelopeTest::class.java.getResource("/launch-v1.json")!!.readText(Charsets.UTF_8)).asJsonObject

class LaunchEnvelopeTest {
    @Test fun `limits and Rider prefix match the TypeScript reference`() {
        val fixtures = launchConformance()
        val limits = fixtures["limits"].asJsonObject
        assertEquals(LaunchEnvelopes.MAX_ENCODED, limits["encoded"].asInt)
        assertEquals(LaunchEnvelopes.MAX_TITLE, limits["title"].asInt)
        assertEquals(LaunchEnvelopes.MAX_STEP, limits["step"].asInt)
        assertEquals(LaunchEnvelopes.RIDER_PREFIX, fixtures["prefixes"].asJsonObject["rider"].asString)
    }

    @Test fun `decoder matches every shared decode case exactly`() {
        val cases = launchConformance()["decode"].asJsonArray.map { it.asJsonObject }
        assertTrue(cases.size > 60)
        for (c in cases) {
            val name = c["name"].asString
            val expected = c["expected"].asJsonObject
            val actual = LaunchEnvelopes.decode(c["encoded"].asString)
            assertEquals(name, expected["ok"].asBoolean, actual.ok)
            if (actual.ok) {
                assertEquals(name, expected["envelope"], actual.envelope!!.toJson())
            } else {
                assertNull(name, actual.envelope)
                assertEquals(name, expected["category"].asString, actual.category)
                assertEquals(name, expected["problems"], Gson().toJsonTree(actual.problems))
            }
        }
    }

    @Test fun `built envelopes decode to their recorded values and Rider URIs`() {
        for (c in launchConformance()["build"].asJsonArray.map { it.asJsonObject }) {
            val expected = c["expected"].asJsonObject
            if (!expected["ok"].asBoolean) continue
            val encoded = expected["encoded"].asString
            val decoded = LaunchEnvelopes.decode(encoded)
            assertEquals(c["name"].asString, expected["envelope"], decoded.envelope!!.toJson())
            assertEquals(LaunchEnvelopes.RIDER_PREFIX + encoded, expected["urls"].asJsonObject["rider"].asString)
        }
    }
}
