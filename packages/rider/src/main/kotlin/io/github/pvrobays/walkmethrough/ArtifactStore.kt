package io.github.pvrobays.walkmethrough

import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.FileVisitResult
import java.nio.file.attribute.BasicFileAttributes

data class ArtifactEntry(val path: Path, val title: String, val id: String, val createdAt: String, val root: Path) {
    override fun toString() = "$title — $id — $createdAt — $root"
}
data class LoadedArtifact(val artifact: Artifact, val root: Path, val warning: String?)

object ArtifactStore {
    private val excluded = setOf(".git", "node_modules", ".gradle", ".intellijPlatform", "build", "dist", "out", "bin", "obj", ".idea", "vendor", ".venv", "target")

    fun discover(roots: List<Path>, checkCancelled: () -> Unit): List<ArtifactEntry> {
        val found = linkedMapOf<Path, ArtifactEntry>()
        val visited = mutableSetOf<Path>()
        for (root in roots) {
            checkCancelled()
            if (!Files.isDirectory(root, NOFOLLOW_LINKS)) continue
            Files.walkFileTree(root, object : SimpleFileVisitor<Path>() {
                override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                    checkCancelled()
                    if (dir != root && (dir.fileName.toString() in excluded || Files.isSymbolicLink(dir) || attrs.isOther)) return FileVisitResult.SKIP_SUBTREE
                    val canonical = dir.toRealPath()
                    if (!visited.add(canonical)) return FileVisitResult.SKIP_SUBTREE
                    if (dir.fileName.toString() == ".walk-me-through") {
                        val storage = dir.resolve("walkthroughs")
                        if (Files.isDirectory(storage, NOFOLLOW_LINKS)) Files.newDirectoryStream(storage, "*.json").use { files ->
                            for (file in files) {
                                checkCancelled()
                                if (!Files.isRegularFile(file, NOFOLLOW_LINKS)) continue
                                val entry = try {
                                    val loaded = load(file)
                                    ArtifactEntry(file.toRealPath(), loaded.artifact.title, loaded.artifact.id, loaded.artifact.createdAt, loaded.root)
                                } catch (_: java.io.IOException) { null } catch (_: IllegalArgumentException) { null }
                                if (entry != null) found[entry.path] = entry
                            }
                        }
                        return FileVisitResult.SKIP_SUBTREE
                    }
                    return FileVisitResult.CONTINUE
                }
                override fun visitFileFailed(file: Path, exc: java.io.IOException): FileVisitResult {
                    checkCancelled(); return FileVisitResult.CONTINUE
                }
            })
        }
        return found.values.sortedWith(compareByDescending<ArtifactEntry> { it.createdAt }.thenBy { it.path.toString() })
    }

    fun load(path: Path): LoadedArtifact {
        val absolute = path.toAbsolutePath().normalize()
        require(absolute.parent?.fileName?.toString() == "walkthroughs" && absolute.parent.parent?.fileName?.toString() == ".walk-me-through") {
            "$path: Choose a JSON artifact inside <project>/.walk-me-through/walkthroughs/."
        }
        val root = absolute.parent.parent.parent.toRealPath()
        val realArtifact = absolute.toRealPath()
        require(realArtifact.startsWith(root)) { "$path: Artifact link escapes its containing project." }
        val artifact = ArtifactReader.read(SourceText.decode(Files.readAllBytes(realArtifact)), path.toString())
        val recorded = runCatching { Path.of(artifact.recordedRoot).toRealPath() }.getOrElse { Path.of(artifact.recordedRoot).toAbsolutePath().normalize() }
        val warning = if (recorded == root) null else "Walkthrough moved: recorded root ${artifact.recordedRoot}; current root $root. Source is loaded from the current root."
        return LoadedArtifact(artifact, root, warning)
    }

    fun source(root: Path, relative: String): Path {
        require(isRelativeSourcePath(relative)) { "$relative: Expected a safe project-relative forward-slash source path." }
        val canonicalRoot = root.toRealPath()
        val candidate = canonicalRoot.resolve(relative).normalize()
        require(candidate.startsWith(canonicalRoot)) { "$relative: Source escapes $canonicalRoot." }
        // Check the closest existing ancestor too, so a missing leaf cannot hide a linked escape.
        var ancestor = candidate
        while (!Files.exists(ancestor, NOFOLLOW_LINKS)) ancestor = ancestor.parent ?: error("$relative: No source parent.")
        require(ancestor.toRealPath().startsWith(canonicalRoot)) { "$relative: Source link escapes $canonicalRoot." }
        return if (Files.exists(candidate)) candidate.toRealPath() else candidate
    }
}
