package io.github.pvrobays.walkmethrough

import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.testFramework.fixtures.IdeaTestFixtureFactory
import com.intellij.testFramework.fixtures.CodeInsightTestFixture
import com.intellij.testFramework.EdtTestUtil
import com.intellij.testFramework.TestApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ex.ProjectManagerEx
import com.jetbrains.rd.ide.model.RdOpenSolution
import com.jetbrains.rd.ide.model.RdVirtualSolution
import com.jetbrains.rd.ide.model.RdPath
import com.jetbrains.rider.projectView.SolutionManager
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.nio.file.Files
import java.nio.file.Path
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.util.Disposer
import com.intellij.testFramework.PlatformTestUtil
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Document
import com.intellij.openapi.util.registry.Registry
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.impl.SimpleDataContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import junit.framework.TestCase
import com.intellij.notification.NotificationType

class PlayerPlatformTest : TestCase() {
    private lateinit var myFixture: CodeInsightTestFixture
    private lateinit var project: Project
    private lateinit var directory: Path

    override fun setUp() {
        super.setUp()
        TestApplicationManager.getInstance()
        Registry.get("patch.engine.backend.freeze.timeout").setValue(false)
        directory = Files.createTempDirectory("wmt-rider-platform-")
        // Installed SDK omits Kotlin package metadata for this helper; call its public JVM API.
        val rdPath = Class.forName("com.jetbrains.rider.ijent.extensions.PathExtKt")
            .getMethod("toRd", java.nio.file.Path::class.java).invoke(null, directory) as RdPath
        // Use Rider's normal solution-opening path; generic fixture projects have no protocol solution.
        project = runBlocking {
            withTimeout(120_000) {
                requireNotNull(SolutionManager.openSolution(null, true,
                    RdOpenSolution(RdVirtualSolution(directory.fileName.toString(), rdPath, emptyList()), false)))
            }
        }
        edt {
            Class.forName("com.jetbrains.rider.test.framework.TestFrameworkKt")
                .getMethod("waitForFullStartup", Project::class.java, Boolean::class.javaPrimitiveType, java.time.Duration::class.java)
                .invoke(null, project, true, java.time.Duration.ofSeconds(90))
        }
        val factory = IdeaTestFixtureFactory.getFixtureFactory()
        myFixture = factory.createCodeInsightFixtureForExistingProject(project)
        myFixture.setUp()
    }

    override fun tearDown() {
        try {
            if (::myFixture.isInitialized) myFixture.tearDown()
            if (::project.isInitialized && !project.isDisposed) EdtTestUtil.runInEdtAndWait<RuntimeException> {
                ProjectManagerEx.getInstanceEx().forceCloseProject(project)
            }
        } finally { super.tearDown() }
    }

    fun testUnsavedDocumentCoordinatesAndOwnedHighlight() {
        EdtTestUtil.runInEdtAndWait<RuntimeException> {
        val file = myFixture.configureByText("Sample.cs", "\t😀value(x)\nsecond\n")
        val editor = myFixture.editor
        val document = editor.document
        val snapshot = SourceText.snapshot(document.text)
        val start = snapshot.editorOffset(Position(0, 9))
        val end = snapshot.editorOffset(Position(0, 10))
        assertEquals("x", document.text.substring(start, end))
        val h = editor.markupModel.addRangeHighlighter(start, end, HighlighterLayer.SELECTION - 1,
            highlightAttributes(false), HighlighterTargetArea.EXACT_RANGE)
        assertEquals(start, h.startOffset)
        assertEquals(end, h.endOffset)
        val stamp = document.modificationStamp
        WriteCommandAction.runWriteCommandAction(project) { document.insertString(0, "// unsaved\n") }
        assertTrue(document.modificationStamp != stamp)
        assertEquals("x", document.text.substring(h.startOffset, h.endOffset))
        h.dispose()
        assertFalse(h.isValid)
        assertNotNull(file.virtualFile)
        }
    }

    fun testProjectSessionServiceNavigationAndClose() {
        EdtTestUtil.runInEdtAndWait<RuntimeException> {
        val session = project.getService(WalkthroughSession::class.java)
        val a = ArtifactReader.read(conformance()["navigation"].asJsonObject["artifact"].toString(), "fixture.json")
        session.open(a, java.nio.file.Path.of("."))
        session.select("a")
        session.skipDetails()
        assertEquals("b", session.current!!.id)
        session.previous()
        assertEquals("a2", session.current!!.id)
        session.close()
        assertFalse(session.active)
        }
    }

    private fun edt(action: () -> Unit) = EdtTestUtil.runInEdtAndWait<RuntimeException> { action() }
    private fun await(condition: () -> Boolean) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
        while (System.nanoTime() < deadline) {
            var done = false
            edt { PlatformTestUtil.dispatchAllInvocationEventsInIdeEventQueue(); done = condition() }
            if (done) return
            Thread.sleep(20)
        }
        fail("Timed out waiting for presentation")
    }

    private fun sourceArtifact(): Artifact {
        Files.createDirectories(directory.resolve("src"))
        Files.writeString(directory.resolve("src/sample.cs"), "x")
        return ArtifactReader.read(conformance()["navigation"].asJsonObject["artifact"].toString(), "fixture.json")
    }

    fun testPresenterUsesUnsavedTextAndCleansExactUncertainStaleNarrative() {
        val artifact = sourceArtifact()
        val session = project.getService(WalkthroughSession::class.java)
        lateinit var presenter: StepPresenter
        edt { presenter = StepPresenter(project, session); session.open(artifact, directory); session.select("a") }
        try {
            await { session.lastResolution?.state == "exact" }
            edt { assertEquals(0, presenter.ownedHighlight!!.startOffset); assertEquals(1, presenter.ownedHighlight!!.endOffset) }
            val file = LocalFileSystem.getInstance().findFileByNioFile(directory.resolve("src/sample.cs"))!!
            val document = ReadAction.compute<Document, RuntimeException> { FileDocumentManager.getInstance().getDocument(file)!! }
            edt { WriteCommandAction.runWriteCommandAction(project) { document.insertString(0, "new\n") }; session.refresh() }
            await { session.lastResolution?.state == "relocated" }
            edt { assertEquals(4, presenter.ownedHighlight!!.startOffset) }
            edt { WriteCommandAction.runWriteCommandAction(project) { document.setText("changed(x)") }; session.refresh() }
            await { session.lastResolution?.state == "uncertain" }
            edt { assertEquals(8, presenter.ownedHighlight!!.startOffset) }
            edt {
                assertEquals(com.intellij.openapi.editor.markup.EffectType.BOLD_DOTTED_LINE, presenter.ownedHighlight!!.textAttributes!!.effectType)
            }
            edt { WriteCommandAction.runWriteCommandAction(project) { document.setText("gone") }; session.refresh() }
            await { session.lastResolution?.state == "stale" }
            edt { assertNull(presenter.ownedHighlight); session.select("overview"); assertNull(presenter.ownedHighlight); assertNull(session.lastResolution) }
            assertEquals("x", Files.readString(directory.resolve("src/sample.cs")))
            edt { session.close(); assertNull(presenter.ownedHighlight) }
        } finally { edt { Disposer.dispose(presenter); session.close() } }
    }

    fun testChangedSnapshotRetriesAndCloseInvalidatesDeferredPresentation() {
        val artifact = sourceArtifact()
        val session = project.getService(WalkthroughSession::class.java)
        val captured = CountDownLatch(1); val release = CountDownLatch(1)
        lateinit var presenter: StepPresenter
        edt {
            presenter = StepPresenter(project, session) { captured.countDown(); release.await(10, TimeUnit.SECONDS) }
            session.open(artifact, directory); session.select("a")
        }
        try {
            assertTrue(captured.await(15, TimeUnit.SECONDS))
            val file = LocalFileSystem.getInstance().findFileByNioFile(directory.resolve("src/sample.cs"))!!
            val document = ReadAction.compute<Document, RuntimeException> { FileDocumentManager.getInstance().getDocument(file)!! }
            edt { WriteCommandAction.runWriteCommandAction(project) { document.setText("new\nx") } }
            release.countDown()
            await { session.lastResolution?.state == "relocated" }
            edt { assertEquals(4, presenter.ownedHighlight!!.startOffset); session.close() }
            await { !session.active && presenter.ownedHighlight == null }
        } finally { release.countDown(); edt { Disposer.dispose(presenter); session.close() } }
    }

    fun testPanelOutlineActionsAndEmptyStates() {
        val artifact = sourceArtifact()
        val session = project.getService(WalkthroughSession::class.java)
        edt {
            val panel = PlayerPanel(project)
            try {
                assertFalse(panel.control("Next").isEnabled)
                session.open(artifact, directory)
                assertTrue(panel.control("Next").isEnabled)
                session.select("a")
                panel.outline.collapsePath(panel.outline.selectionPath)
                panel.control("Next").doClick()
                assertEquals("a1", session.current!!.id)
                assertTrue(panel.outline.isExpanded(panel.outline.selectionPath.parentPath))
                session.select("a111")
                val path = panel.outline.selectionPath
                assertTrue(panel.outline.isExpanded(path.parentPath))
                assertEquals("a111", (path.lastPathComponent as javax.swing.tree.DefaultMutableTreeNode).userObject)
                assertTrue(panel.control("Skip Details").toolTipText.contains("Skip nested details"))
                session.lastResolution = Resolution("stale", reason = "not-found", candidateCount = 0); session.changed()
                assertTrue(panel.explanationStatus.contains("Original code not found"))
                val replacement = Artifact(artifact.raw.deepCopy(), artifact.steps.map { if (it.id == "a111") it.copy(title = "Replacement", location = null) else it })
                session.open(replacement, directory); session.select("a111")
                assertTrue(panel.explanationStatus.contains("Narrative"))
                assertTrue(panel.control("Return").isFocusable)
                session.close()
                assertFalse(panel.control("Return").isEnabled)
                assertTrue(panel.explanationStatus.contains("Overview"))
            } finally { Disposer.dispose(panel); session.close() }
        }
    }

    fun testCloseDuringDeferredSnapshotCannotRestorePresentation() {
        val artifact = sourceArtifact()
        val session = project.getService(WalkthroughSession::class.java)
        val captured = CountDownLatch(1); val release = CountDownLatch(1); val completed = CountDownLatch(1)
        lateinit var presenter: StepPresenter
        edt {
            presenter = StepPresenter(project, session) {
                captured.countDown()
                // Simulate a read that still finishes despite cancellation.
                while (release.count > 0) try { release.await() } catch (_: InterruptedException) { }
                completed.countDown()
            }
            session.open(artifact, directory); session.select("a")
        }
        try {
            assertTrue(captured.await(15, TimeUnit.SECONDS))
            edt { session.close() }
            release.countDown()
            assertTrue(completed.await(15, TimeUnit.SECONDS))
            edt { PlatformTestUtil.dispatchAllInvocationEventsInIdeEventQueue(); assertFalse(session.active); assertNull(session.lastResolution); assertNull(presenter.ownedHighlight) }
            edt { session.open(artifact, directory); session.select("a"); session.select("overview") }
            edt { PlatformTestUtil.dispatchAllInvocationEventsInIdeEventQueue(); assertNull(presenter.ownedHighlight); assertNull(session.current) }
        } finally { release.countDown(); edt { Disposer.dispose(presenter); session.close() } }
    }

    fun testRegisteredActionAvailabilityAndDisabledNoOps() {
        val session = project.getService(WalkthroughSession::class.java)
        val artifact = sourceArtifact()
        edt {
            val manager = com.intellij.openapi.actionSystem.ActionManager.getInstance()
            val context = SimpleDataContext.getSimpleContext(CommonDataKeys.PROJECT, project)
            fun event(id: String): Pair<com.intellij.openapi.actionSystem.AnAction, AnActionEvent> {
                val action = manager.getAction("WalkMeThrough.$id")
                assertNotNull(action)
                return action to AnActionEvent.createFromAnAction(action, null, "test", context)
            }
            for (id in listOf("Next", "Previous", "Skip", "Return", "Close")) {
                val (action, e) = event(id); action.update(e); assertFalse(e.presentation.isEnabled); action.actionPerformed(e)
            }
            assertFalse(session.active)
            session.open(artifact, directory)
            val (next, e) = event("Next"); next.update(e); assertTrue(e.presentation.isEnabled); next.actionPerformed(e)
            assertEquals("a", session.current!!.id)
            session.select("b")
            val (skip, skipEvent) = event("Skip"); skip.update(skipEvent); assertFalse(skipEvent.presentation.isEnabled); skip.actionPerformed(skipEvent)
            assertEquals("b", session.current!!.id)
            session.close()
        }
    }

    fun testSeparateProjectsAndProjectDisposalOwnPresentationResources() {
        val otherDirectory = Files.createTempDirectory("wmt-rider-other-")
        val rdPath = Class.forName("com.jetbrains.rider.ijent.extensions.PathExtKt")
            .getMethod("toRd", Path::class.java).invoke(null, otherDirectory) as RdPath
        val other = runBlocking { withTimeout(120_000) {
            requireNotNull(SolutionManager.openSolution(null, true, RdOpenSolution(RdVirtualSolution("Other", rdPath, emptyList()), false)))
        } }
        edt {
            val first = project.getService(WalkthroughSession::class.java)
            val second = other.getService(WalkthroughSession::class.java)
            val artifact = sourceArtifact()
            first.open(artifact, directory); second.open(artifact, otherDirectory)
            val owner = Disposer.newDisposable()
            Disposer.register(other, owner)
            val panel = PlayerPanel(other)
            Disposer.register(owner, panel)
            ProjectManagerEx.getInstanceEx().forceCloseProject(other)
            assertTrue(Disposer.isDisposed(owner))
            assertFalse(second.active)
            assertTrue(first.active)
            first.close()
        }
    }

    fun testPresenterMultilineDeletedUnreadableAndNarrativeDoNotInventLocations() {
        val a = sourceArtifact()
        val text = "head\nfirst\nsecond\ntail"
        Files.writeString(directory.resolve("src/sample.cs"), text)
        val raw = a.raw.deepCopy()
        val loc = raw["steps"].asJsonArray[0].asJsonObject["location"].asJsonObject
        val selection = "first\nsecond"
        val range = SourceRange(Position(1, 0), Position(2, 6))
        val anchor = Anchor("sha256-lf-v1", selection, AnchorContext(1, 2, selection.length, SourceText.hash(selection), true), SelectionOffsets(0, selection.length))
        loc.add("range", com.google.gson.Gson().toJsonTree(range)); loc.add("anchor", com.google.gson.Gson().toJsonTree(anchor))
        val artifact = ArtifactReader.read(raw.toString(), "multiline.json")
        val session = project.getService(WalkthroughSession::class.java)
        lateinit var presenter: StepPresenter
        edt { presenter = StepPresenter(project, session); session.open(artifact, directory); session.select("a") }
        try {
            await { session.lastResolution?.state == "exact" }
            edt {
                assertEquals(5, presenter.ownedHighlight!!.startOffset)
                assertEquals(17, presenter.ownedHighlight!!.endOffset)
                session.select("overview")
                assertNull(presenter.ownedHighlight)
                val editors = FileEditorManager.getInstance(project)
                editors.openFiles.forEach(editors::closeFile)
            }
            Files.write(directory.resolve("src/binary.cs"), byteArrayOf(0xc3.toByte(), 0x28))
            val bad = raw.deepCopy()
            bad["steps"].asJsonArray[0].asJsonObject["location"].asJsonObject.addProperty("path", "src/binary.cs")
            edt { session.open(ArtifactReader.read(bad.toString(), "binary.json"), directory); session.select("a") }
            await { session.lastResolution?.reason == "unreadable" }
            edt { assertNull(presenter.ownedHighlight); assertTrue(FileEditorManager.getInstance(project).openFiles.isEmpty()) }
            bad["steps"].asJsonArray[0].asJsonObject["location"].asJsonObject.addProperty("path", "src/deleted.cs")
            edt { session.open(ArtifactReader.read(bad.toString(), "deleted.json"), directory); session.select("a") }
            await { session.lastResolution?.reason == "file-missing" }
            edt { assertNull(presenter.ownedHighlight); assertTrue(FileEditorManager.getInstance(project).openFiles.isEmpty()) }
            val unsafe = artifact.copy(steps = artifact.steps.map { if (it.id == "a") it.copy(location = it.location!!.copy(path = "../escape.cs")) else it })
            edt { session.open(unsafe, directory); session.select("a") }
            await { session.lastResolution?.reason?.startsWith("source-error:") == true }
            edt { assertNull(presenter.ownedHighlight); assertTrue(FileEditorManager.getInstance(project).openFiles.isEmpty()) }
        } finally { edt { Disposer.dispose(presenter); session.close() } }
    }

    private class Recorder : LaunchFeedback {
        val notices = java.util.Collections.synchronizedList(mutableListOf<Triple<Project?, NotificationType, String>>())
        override fun notify(project: Project?, type: NotificationType, message: String) { notices.add(Triple(project, type, message)) }
    }
    private fun envelope(root: Path, id: String, step: String? = null, platform: String = "win32", version: Int = 1): String {
        val json = com.google.gson.JsonObject().apply {
            addProperty("v", version); addProperty("root", root.toString())
            add("env", com.google.gson.JsonObject().apply { addProperty("kind", "local"); addProperty("platform", platform) })
            addProperty("id", id); step?.let { addProperty("step", it) }; addProperty("title", "<b>Forged title</b>")
        }
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(json.toString().toByteArray(Charsets.UTF_8))
    }
    /** Writes `<root>/.walk-me-through/walkthroughs/<fileId>.json` holding the navigation fixture with `contentId`. */
    private fun publishAt(root: Path, fileId: String, contentId: String = fileId, content: String? = null): Path {
        Files.createDirectories(root.resolve("src")); Files.writeString(root.resolve("src/sample.cs"), "x")
        val raw = conformance()["navigation"].asJsonObject["artifact"].asJsonObject.deepCopy()
        raw.addProperty("id", contentId)
        raw["project"].asJsonObject.addProperty("root", root.toRealPath().toString())
        val file = root.resolve(".walk-me-through/walkthroughs/$fileId.json")
        Files.createDirectories(file.parent); Files.writeString(file, content ?: raw.toString())
        return file
    }

    fun testLaunchCommandValidatesMatchesAndPlaysRequestedStep() {
        val ids = listOf("20261021T150000001Z-aaaaaa", "20261021T150000002Z-bbbbbb", "20261021T150000003Z-cccccc", "20261021T150000004Z-dddddd")
        publishAt(directory, ids[0]); publishAt(directory, ids[1], ids[0]); publishAt(directory, ids[2], content = "{\"schemaVersion\": 2}")
        val unrelated = Files.createTempDirectory("wmt-rider-unrelated-"); publishAt(unrelated, ids[0])
        val session = project.getService(WalkthroughSession::class.java)
        val recorder = Recorder()
        fun launch(e: String?, target: String? = "open", refusal: String? = null): LaunchResult {
            lateinit var result: LaunchResult
            edt { result = LaunchHandling.handle(target, if (e == null) emptyMap() else mapOf("e" to e), refusal, "Windows 11", recorder, listOf(project), null) }
            return result
        }
        try {
            assertEquals("scheduled", launch(envelope(directory, ids[0])).kind)
            await { session.active && session.artifact!!.id == ids[0] }
            edt { assertNull(session.current); assertEquals("Conformance", session.artifact!!.title) }
            assertEquals("scheduled", launch(envelope(directory, ids[0], "a111")).kind)
            await { session.current?.id == "a111" }
            assertEquals("scheduled", launch(envelope(directory, ids[0], "b")).kind)
            await { session.current?.id == "b" }
            assertEquals("scheduled", launch(envelope(directory, ids[0], "missing")).kind)
            await { recorder.notices.any { it.second == NotificationType.INFORMATION && it.third.contains("\"missing\" was not found") } }
            edt { assertTrue(session.active); assertNull(session.current) }
            edt { session.select("a") }
            val unchanged = { edt { assertEquals(ids[0], session.artifact!!.id); assertEquals("a", session.current!!.id) } }
            for ((result, kind) in listOf(
                launch(envelope(unrelated, ids[0])) to "no-match",
                launch(envelope(directory.resolve("missing-root"), ids[0])) to "no-match",
                launch(envelope(directory, ids[3])) to "artifact-removed",
                launch(envelope(directory, ids[0], platform = "linux")) to "environment",
                launch(envelope(directory, ids[0]), refusal = PlaybackEnvironment.refusal("Linux", false, false)) to "environment",
                launch("not*valid") to "invalid-link",
                launch(envelope(directory, ids[0]).dropLast(3)) to "invalid-link",
                launch(envelope(directory, ids[0], version = 2)) to "newer-version",
                launch(envelope(directory, ids[0]), target = "other") to "invalid-link",
                launch(null) to "invalid-link",
            )) { assertEquals(result.message, kind, result.kind); unchanged() }
            assertEquals(PlaybackEnvironment.refusal("Linux", false, false), recorder.notices.first { it.third.contains("native Windows Rider") }.third)
            assertTrue(recorder.notices.first { it.third.contains("is not open in Rider") }.third.contains(unrelated.toString()))
            assertEquals(project, recorder.notices.first { it.third.contains("was removed") }.first)
            assertNull(recorder.notices.first { it.third.contains("is not open in Rider") }.first)
            val before = recorder.notices.size
            assertEquals("scheduled", launch(envelope(directory, ids[1])).kind)
            assertEquals("scheduled", launch(envelope(directory, ids[2])).kind)
            await { recorder.notices.size >= before + 2 }
            val errors = recorder.notices.drop(before).map { it.third }
            assertTrue(errors.toString(), errors.any { it.contains("expected walkthrough ID ${ids[1]}") })
            assertTrue(errors.toString(), errors.any { it.contains("schemaVersion") })
            unchanged()
            assertEquals("x", Files.readString(directory.resolve("src/sample.cs")))
        } finally { edt { session.close() } }
    }

    fun testLaunchChoosesLastFocusedThenLatestOpenedMatchingProject() {
        val inner = Files.createDirectories(directory.resolve("inner"))
        val id = "20261021T150000005Z-eeeeee"
        publishAt(inner, id)
        val rdPath = Class.forName("com.jetbrains.rider.ijent.extensions.PathExtKt")
            .getMethod("toRd", Path::class.java).invoke(null, inner) as RdPath
        val other = runBlocking { withTimeout(120_000) {
            requireNotNull(SolutionManager.openSolution(null, true, RdOpenSolution(RdVirtualSolution("Inner", rdPath, emptyList()), false)))
        } }
        try {
            val recorder = Recorder()
            val windows = LaunchHandling.platformOf(System.getProperty("os.name")) == "win32"
            val root = LaunchHandling.canonical(inner.toString(), windows)!!
            edt {
                assertEquals(other, LaunchHandling.choose(root, listOf(project, other), null, windows))
                assertEquals(project, LaunchHandling.choose(root, listOf(project, other), project, windows))
                assertEquals(other, LaunchHandling.choose(root, listOf(project, other), other, windows))
                assertNull(LaunchHandling.choose(LaunchHandling.canonical(Files.createTempDirectory("wmt-none-").toString(), windows)!!, listOf(project, other), project, windows))
            }
            lateinit var result: LaunchResult
            edt { result = LaunchHandling.handle("open", mapOf("e" to envelope(inner, id)), null, "Windows 11", recorder, listOf(project, other), project) }
            assertEquals(project, result.project)
            await { project.getService(WalkthroughSession::class.java).active }
            edt { assertFalse(other.getService(WalkthroughSession::class.java).active) }
            edt { result = LaunchHandling.handle("open", mapOf("e" to envelope(inner, id, "a1")), null, "Windows 11", recorder, listOf(project, other), null) }
            assertEquals(other, result.project)
            await { other.getService(WalkthroughSession::class.java).current?.id == "a1" }
        } finally {
            edt { project.getService(WalkthroughSession::class.java).close(); if (!other.isDisposed) ProjectManagerEx.getInstanceEx().forceCloseProject(other) }
        }
    }
}

class LaunchPathTest {
    @org.junit.Test fun `containment is separator bounded and Windows comparison is case-insensitive`() {
        org.junit.Assert.assertTrue(LaunchHandling.contains("c:\\repo", "c:\\repo", true))
        org.junit.Assert.assertTrue(LaunchHandling.contains("c:\\repo", "c:\\repo\\sub", true))
        org.junit.Assert.assertTrue(LaunchHandling.contains("c:", "c:\\repo", true))
        org.junit.Assert.assertFalse(LaunchHandling.contains("c:\\repo", "c:\\repo-copy", true))
        org.junit.Assert.assertTrue(LaunchHandling.contains("/home/me", "/home/me/repo", false))
        org.junit.Assert.assertFalse(LaunchHandling.contains("/home/me", "/home/meow", false))
        val temp = Files.createTempDirectory("wmt-canonical-")
        org.junit.Assert.assertEquals(LaunchHandling.canonical(temp.toString(), true), LaunchHandling.canonical(temp.toString().uppercase(), true))
        org.junit.Assert.assertNull(LaunchHandling.canonical(temp.resolve("missing").toString(), true))
        org.junit.Assert.assertEquals("win32", LaunchHandling.platformOf("Windows 11"))
        org.junit.Assert.assertEquals("linux", LaunchHandling.platformOf("Linux"))
    }
}
