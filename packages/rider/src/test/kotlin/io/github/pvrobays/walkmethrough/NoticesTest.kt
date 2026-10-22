package io.github.pvrobays.walkmethrough

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.listDirectoryEntries
import kotlin.io.path.name

class NoticesTest {
    private val pluginDirectory = Path.of(requireNotNull(System.getProperty("wmt.pluginDirectory")) { "Run through Gradle: test depends on prepareSandbox." })
    private val notices = Files.readString(Path.of("THIRD-PARTY-NOTICES.txt"))

    @Test fun `notices name every bundled jar with its version, and the plugin root carries LICENSE and the notices`() {
        val jars = pluginDirectory.resolve("lib").listDirectoryEntries("*.jar").map { it.name }.filterNot { it.startsWith("walk-me-through-rider-") }.sorted()
        assertEquals(listOf("commonmark-0.24.0.jar", "error_prone_annotations-2.41.0.jar", "gson-2.13.2.jar"), jars)
        for (jar in jars) assertTrue(jar, notices.contains("\n$jar - "))
        assertTrue(notices.contains("highlight.js 11.11.1 (BSD-3-Clause)"))
        assertTrue(Files.readString(pluginDirectory.resolve("LICENSE")).startsWith("MIT License"))
        assertEquals(notices, Files.readString(pluginDirectory.resolve("THIRD-PARTY-NOTICES.txt")))
    }
}
