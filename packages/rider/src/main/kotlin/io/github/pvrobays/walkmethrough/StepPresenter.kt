package io.github.pvrobays.walkmethrough

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.ex.RangeHighlighterEx
import com.intellij.openapi.editor.markup.EffectType
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.EditorFactoryEvent
import com.intellij.openapi.editor.event.EditorFactoryListener
import com.intellij.ui.JBColor
import java.awt.Color
import java.nio.file.Files
import java.util.concurrent.Future

/** Snapshot matching is off EDT; presentation is installed only for the current generation/stamp. */
class StepPresenter(private val project: Project, private val session: WalkthroughSession,
    private val afterSnapshot: () -> Unit = {}) : Disposable {
    private var work: Future<*>? = null
    private var highlighter: RangeHighlighter? = null
    private var disposed = false

    init {
        session.clearPresentation = ::clear; session.show = ::show
        EditorFactory.getInstance().addEditorFactoryListener(object : EditorFactoryListener {
            override fun editorReleased(event: EditorFactoryEvent) {
                if (event.editor.project == project && highlighter?.isValid == false) highlighter = null
            }
        }, this)
    }

    fun show() {
        val step = session.current ?: return
        val location = step.location ?: return
        val root = session.root ?: return
        val generation = session.generation
        work = ApplicationManager.getApplication().executeOnPooledThread {
            try {
                ProgressManager.checkCanceled()
                val path = ArtifactStore.source(root, location.path)
                val file = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(path)
                val cached = file?.let { FileDocumentManager.getInstance().getCachedDocument(it) }
                // Existing documents (including unsaved buffers) are authoritative. Strict disk decoding precedes new documents.
                val disk = if (cached == null && Files.exists(path)) SourceText.decode(Files.readAllBytes(path)) else null
                if (file == null || (!Files.exists(path) && cached == null)) {
                    publish(generation, AnchorResolver.resolve(location.anchor, location.range, null)); return@executeOnPooledThread
                }
                val document = cached ?: ReadAction.compute<Document?, RuntimeException> { FileDocumentManager.getInstance().getDocument(file) }
                if (document == null) {
                    publish(generation, AnchorResolver.resolve(location.anchor, location.range, disk, unreadable = true)); return@executeOnPooledThread
                }
                val snapshot = ReadAction.compute<Pair<String, Long>, RuntimeException> { document.immutableCharSequence.toString() to document.modificationStamp }
                val normalized = SourceText.snapshot(snapshot.first)
                val resolution = AnchorResolver.resolve(location.anchor, location.range, normalized.text)
                afterSnapshot()
                ApplicationManager.getApplication().invokeLater {
                    if (!current(generation)) return@invokeLater
                    if (document.modificationStamp != snapshot.second) { session.refresh(); return@invokeLater }
                    session.lastResolution = resolution
                    resolution.range?.let { range ->
                        val start = normalized.editorOffset(range.start); val end = normalized.editorOffset(range.end)
                        val editor = FileEditorManager.getInstance(project).openTextEditor(OpenFileDescriptor(project, file, start), true)
                        if (editor != null) highlighter = editor.markupModel.addRangeHighlighter(start, end,
                            HighlighterLayer.SELECTION - 1, highlightAttributes(resolution.state == "uncertain"), HighlighterTargetArea.EXACT_RANGE)
                    }
                    session.changed()
                }
            } catch (_: java.util.concurrent.CancellationException) {
            } catch (_: com.intellij.openapi.progress.ProcessCanceledException) {
            } catch (error: IllegalArgumentException) {
                publish(generation, Resolution("stale", reason = "source-error: ${location.path}: ${error.message}", candidateCount = 0))
            } catch (error: Exception) {
                publish(generation, Resolution("stale", reason = if (error is java.nio.file.NoSuchFileException) "file-missing" else "unreadable", candidateCount = 0))
            }
        }
    }

    private fun publish(generation: Long, result: Resolution) {
        ApplicationManager.getApplication().invokeLater {
            if (current(generation)) { session.lastResolution = result; session.changed() }
        }
    }
    private fun current(generation: Long) = !disposed && !project.isDisposed && session.active && session.generation == generation
    private fun clear() { work?.cancel(true); work = null; highlighter?.dispose(); highlighter = null }
    fun themeChanged() { (highlighter as? RangeHighlighterEx)?.setTextAttributes(highlightAttributes(session.lastResolution?.state == "uncertain")) }
    override fun dispose() { disposed = true; clear(); session.show = {}; session.clearPresentation = {} }
    internal val ownedHighlight get() = highlighter
}

internal fun highlightAttributes(uncertain: Boolean) = TextAttributes().apply {
    backgroundColor = JBColor.namedColor("WalkMeThrough.highlight", JBColor(Color(225, 238, 255), Color(45, 65, 85)))
    effectColor = if (uncertain) JBColor.ORANGE else JBColor.BLUE
    effectType = if (uncertain) EffectType.BOLD_DOTTED_LINE else EffectType.BOXED
}
