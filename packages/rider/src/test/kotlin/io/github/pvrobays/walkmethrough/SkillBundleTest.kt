package io.github.pvrobays.walkmethrough

import com.google.gson.JsonParser
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path

class SkillBundleTest {
    private val files = listOf("SKILL.md", "manifest.json", "references/walkthrough-format.md", "scripts/publish-walkthrough.mjs")
    private fun resource(name: String): ByteArray =
        requireNotNull(SkillBundleTest::class.java.getResource("/skill/$name")) { "skill/$name must be bundled" }.readBytes()

    @Test fun `plugin resources carry the four canonical skill files`() {
        // Gradle runs tests from packages/rider; ../skill is the canonical TypeScript-built bundle.
        for (name in files) assertArrayEquals(name, Files.readAllBytes(Path.of("../skill", name)), resource(name))
    }

    @Test fun `SourceText hashing of the shipped files equals the TypeScript manifest`() {
        val manifest = JsonParser.parseString(String(resource("manifest.json"), Charsets.UTF_8)).asJsonObject
        assertEquals("0.2.0", manifest["bundleVersion"].asString)
        val hashes = manifest["files"].asJsonObject
        assertEquals(files.filter { it != "manifest.json" }.sorted(), hashes.keySet().sorted())
        for (name in hashes.keySet()) assertEquals(name, hashes[name].asString, SourceText.hash(SourceText.decode(resource(name))))
        // Kotlin and TypeScript normalize the same way: a BOM and CRLF copy keeps the hash.
        val skill = String(resource("SKILL.md"), Charsets.UTF_8)
        assertEquals(hashes["SKILL.md"].asString, SourceText.hash(SourceText.decode(("\ufeff" + skill.replace("\n", "\r\n")).toByteArray(Charsets.UTF_8))))
    }
}
