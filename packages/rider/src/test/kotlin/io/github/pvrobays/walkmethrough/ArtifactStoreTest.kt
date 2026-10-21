package io.github.pvrobays.walkmethrough

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CancellationException

class ArtifactStoreTest {
    @get:Rule val temp = TemporaryFolder()
    private fun artifact(root: Path, id: String = "20261021T143005123Z-abcdef", createdAt: String = "2026-10-21T14:30:05.123Z"): Path {
        val input = conformance()["navigation"].asJsonObject["artifact"].deepCopy().asJsonObject
        input.addProperty("id", id); input.addProperty("createdAt", createdAt)
        input["project"].asJsonObject.addProperty("root", root.toRealPath().toString())
        val storage = Files.createDirectories(root.resolve(".walk-me-through/walkthroughs"))
        Files.writeString(root.resolve(".walk-me-through/.gitignore"), "*")
        return Files.writeString(storage.resolve("$id.json"), input.toString())
    }

    @Test fun `discovery finds ignored nested roots deduplicates and sorts without indexes`() {
        val root = temp.newFolder("project").toPath(); val nested = Files.createDirectories(root.resolve("nested"))
        val external = temp.newFolder("external").toPath()
        artifact(root); artifact(nested, "20261022T143005123Z-abcdef", "2026-10-22T14:30:05.123Z"); artifact(external)
        val dependency = Files.createDirectories(root.resolve("node_modules/dependency")); artifact(dependency)
        val excluded = Files.createDirectories(root.resolve("build/excluded")); val excludedArtifact = artifact(excluded)
        val found = ArtifactStore.discover(listOf(root, nested, external)) {}
        assertEquals(3, found.size)
        assertEquals(nested.toRealPath(), found.first().root)
        assertTrue(found.none { it.root == dependency.toRealPath() || it.root == excluded.toRealPath() })
        assertNotNull(ArtifactStore.load(excludedArtifact)) // Browse can reach excluded storage.
        assertTrue(ArtifactStore.discover(listOf(temp.newFolder("empty").toPath())) {}.isEmpty())
    }

    @Test fun `discovery cancellation propagates and never chooses an artifact`() {
        val root = temp.newFolder("project").toPath(); artifact(root)
        assertThrows(CancellationException::class.java) { ArtifactStore.discover(listOf(root)) { throw CancellationException() } }
        val session = WalkthroughSession()
        ArtifactStore.discover(listOf(root)) {}
        assertFalse(session.active)
    }

    @Test fun `loading derives nested root warns on moved checkout and rejects wrong layout`() {
        val root = temp.newFolder("project").toPath(); val path = artifact(root)
        assertEquals(root.toRealPath(), ArtifactStore.load(path).root)
        assertNull(ArtifactStore.load(path).warning)
        val moved = temp.newFolder("moved").toPath()
        val target = Files.createDirectories(moved.resolve(".walk-me-through/walkthroughs")).resolve("moved.json")
        Files.copy(path, target)
        val result = ArtifactStore.load(target)
        assertEquals(moved.toRealPath(), result.root)
        assertTrue(result.warning!!.contains(root.toString()))
        assertTrue(result.warning.contains(moved.toString()))
        val wrong = Files.copy(path, moved.resolve("wrong.json"))
        assertThrows(IllegalArgumentException::class.java) { ArtifactStore.load(wrong) }
    }

    @Test fun `source rejects absolute traversal Windows forms and preserves missing leaf paths`() {
        val root = temp.newFolder("project").toPath()
        val source = Files.writeString(root.resolve("Sample.cs"), "x")
        assertEquals(source.toRealPath(), ArtifactStore.source(root, "Sample.cs"))
        if (System.getProperty("os.name").startsWith("Windows")) assertEquals(source.toRealPath(), ArtifactStore.source(root, "sample.CS"))
        for (path in listOf("../outside", "a/../../outside", "C:/outside", "C:outside", "\\\\host\\file", "/outside", "a\\b")) {
            val error = assertThrows(IllegalArgumentException::class.java) { ArtifactStore.source(root, path) }
            assertTrue(error.message!!.contains(path))
        }
        assertEquals(root.resolve("missing.cs"), ArtifactStore.source(root, "missing.cs"))
    }

    @Test fun `resolved directory links cannot escape source or expand discovery`() {
        val root = temp.newFolder("linked-project").toPath()
        val outside = temp.newFolder("outside").toPath()
        Files.writeString(outside.resolve("secret.cs"), "secret")
        artifact(outside)
        val link = root.resolve("linked")
        if (System.getProperty("os.name").startsWith("Windows")) {
            val process = ProcessBuilder("cmd.exe", "/c", "mklink", "/J", link.toString(), outside.toString()).redirectErrorStream(true).start()
            val output = process.inputStream.bufferedReader().readText()
            assertEquals(output, 0, process.waitFor())
        } else Files.createSymbolicLink(link, outside)
        try {
            assertThrows(IllegalArgumentException::class.java) { ArtifactStore.source(root, "linked/secret.cs") }
            assertThrows(IllegalArgumentException::class.java) { ArtifactStore.source(root, "linked/missing.cs") }
            assertTrue(ArtifactStore.discover(listOf(root)) {}.isEmpty())
        } finally { Files.delete(link) }
    }
}
