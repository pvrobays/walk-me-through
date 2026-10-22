package io.github.pvrobays.walkmethrough

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path

class SkillInstallerTest {
    private val fixture = JsonParser.parseString(SkillInstallerTest::class.java.getResource("/skill-install.json")!!.readText()).asJsonObject
    private val temporary = mutableListOf<Path>()
    @After fun cleanUp() { temporary.forEach { it.toFile().deleteRecursively() } }

    private val bundle = SkillInstaller.bundle()
    private fun variant(file: String, kind: String): ByteArray =
        if (kind == "exact") bundle.getValue(file)
        else ("\ufeff" + String(bundle.getValue(file), Charsets.UTF_8).replace("\n", "\r\n")).toByteArray(Charsets.UTF_8)
    private fun resolve(base: Path, relative: String): Path = relative.split('/').fold(base) { path, part -> path.resolve(part) }

    @Test fun `shares the skill directory and file list with TypeScript`() {
        assertEquals(SkillInstaller.SKILL_DIRECTORY, fixture["skillDirectory"].asString)
        assertEquals(SkillInstaller.FILES, fixture["files"].asJsonArray.map { it.asString })
    }

    @Test fun `replays every shared skill-install case`() {
        for (case in fixture["cases"].asJsonArray.map { it.asJsonObject }) {
            val name = case["name"].asString
            val base = Files.createTempDirectory("wmt-skill-kt-").toRealPath().also(temporary::add)
            val written = mutableMapOf<String, ByteArray>()
            for (entry in case["setup"].asJsonArray.map { it.asJsonObject }) {
                val relative = entry["path"].asString
                val path = resolve(base, relative)
                when (entry["type"].asString) {
                    "directory" -> Files.createDirectories(path)
                    else -> {
                        val bytes = if (entry["type"].asString == "file") entry["text"].asString.toByteArray(Charsets.UTF_8)
                            else variant(entry["file"].asString, entry["variant"].asString)
                        Files.createDirectories(path.parent); Files.write(path, bytes); written[relative] = bytes
                    }
                }
            }
            val folders = case["folders"].asJsonArray.map { resolve(base, it.asString).also { folder -> Files.createDirectories(folder) } }
            val expected: JsonObject = case["expected"].asJsonObject
            val targets = SkillInstaller.resolveTargets(folders)
            assertEquals(name, expected["targets"].asJsonArray.map { it.asJsonObject["root"].asString to it.asJsonObject["inGit"].asBoolean },
                targets.map { base.relativize(it.root).toString().replace('\\', '/') to it.inGit })
            val outcome = SkillInstaller.install(targets[0].root, bundle)
            assertEquals(name, expected["outcome"].asString, outcome.kind)
            assertEquals(name, expected["created"].asJsonArray.map { it.asString }, (outcome as? InstallOutcome.Installed)?.created ?: emptyList<String>())
            assertEquals(name, expected["differing"].asJsonArray.map { it.asString }, (outcome as? InstallOutcome.Refused)?.differing ?: emptyList<String>())
            assertEquals(name, expected["message"].asString.replace("{skillDir}", SkillInstaller.skillDirectory(targets[0].root).toString()), outcome.message)
            val root = expected["targets"].asJsonArray[0].asJsonObject["root"].asString
            for ((file, state) in expected["after"].asJsonObject.entrySet()) {
                val relative = "$root/${SkillInstaller.SKILL_DIRECTORY}/$file"
                val path = resolve(base, relative)
                when (state.asString) {
                    "missing" -> assertFalse("$name $file", Files.exists(path))
                    "setup" -> assertArrayEquals("$name $file", written.getValue(relative), Files.readAllBytes(path))
                    else -> assertArrayEquals("$name $file", bundle.getValue(file), Files.readAllBytes(path))
                }
            }
        }
    }

    @Test fun `never overwrites a customized file and treats a directory in its place as differing`() {
        val root = Files.createTempDirectory("wmt-skill-kt-").toRealPath().also(temporary::add)
        Files.createDirectories(root.resolve(".git"))
        assertFalse(SkillInstaller.hasSkill(root))
        assertTrue(SkillInstaller.install(root, bundle).message.contains("Commit .agents/skills/walk-me-through/ and restart your agent"))
        assertTrue(SkillInstaller.hasSkill(root))
        val skill = SkillInstaller.skillDirectory(root).resolve("SKILL.md")
        Files.writeString(skill, "customized\n")
        val refused = SkillInstaller.install(root, bundle) as InstallOutcome.Refused
        assertEquals(listOf("SKILL.md"), refused.differing)
        assertTrue(refused.message.contains("left unchanged"))
        assertEquals("customized\n", Files.readString(skill))
        SkillInstaller.skillDirectory(root).toFile().deleteRecursively()
        Files.createDirectories(SkillInstaller.skillDirectory(root).resolve("manifest.json"))
        assertEquals(listOf("manifest.json"), (SkillInstaller.install(root, bundle) as InstallOutcome.Refused).differing)
        assertNull(SkillInstaller.skillDirectory(root).resolve("SKILL.md").toFile().takeIf { it.exists() })
        assertTrue(SkillInstaller.UNSUPPORTED.contains("local desktop"))
    }
}
