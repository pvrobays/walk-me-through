package io.github.pvrobays.walkmethrough

import org.junit.Assert.*
import org.junit.Test

class PresentationTest {
    @Test fun `anchor state messages are visible concise and retain original location`() {
        val artifact = ArtifactReader.read(conformance()["navigation"].asJsonObject["artifact"].toString(), "fixture.json")
        val step = artifact.steps.first()
        assertTrue(stateMessage(step, Resolution("relocated", candidateCount = 1)).contains("relocated"))
        assertTrue(stateMessage(step, Resolution("uncertain", tie = true, candidateCount = 2)).contains("earlier candidate"))
        assertTrue(stateMessage(step, Resolution("stale", reason = "not-found", candidateCount = 0)).contains("src/sample.cs:1"))
        assertEquals("Overview", stateMessage(null, null))
        assertEquals("Narrative", stateMessage(step.copy(location = null), null))
        assertEquals("&lt;script&gt;&amp;", escape("<script>&"))
    }

    @Test fun `environment accepts every native desktop OS and refuses remote and headless hosts`() {
        for (os in listOf("Windows 11", "Linux", "Mac OS X")) {
            assertNull(os, PlaybackEnvironment.refusal(os, false, false))
            assertTrue(PlaybackEnvironment.refusal(os, true, false)!!.contains("Remote development hosts"))
            assertTrue(PlaybackEnvironment.refusal(os, false, true)!!.contains("local desktop Rider"))
        }
        assertFalse(PlaybackEnvironment.LOCAL_DESKTOP.contains("accepted only"))
    }
}
