package io.github.pvrobays.walkmethrough

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import java.nio.file.Path

/** All mutation and presentation callbacks run on the project's UI thread. */
@Service(Service.Level.PROJECT)
class WalkthroughSession : Disposable {
    var artifact: Artifact? = null
        private set
    var root: Path? = null
        private set
    var index = 0
        private set
    var generation = 0L
        private set
    var lastResolution: Resolution? = null
    var show: () -> Unit = {}
    var clearPresentation: () -> Unit = {}
    private val listeners = mutableListOf<() -> Unit>()
    val current: Step? get() = artifact?.steps?.getOrNull(index - 1)
    val active get() = artifact != null
    val hasPrevious get() = active && index > 0
    val hasNext get() = artifact?.let { index < it.steps.size } ?: false
    val skipTarget: Step? get() {
        val steps = artifact?.steps ?: return null
        val current = current ?: return steps.firstOrNull()
        val subtree = mutableSetOf(current.id)
        for (step in steps.drop(index)) {
            if (step.parentId == null || step.parentId !in subtree) return step
            subtree.add(step.id)
        }
        return null
    }

    fun listen(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    fun open(value: Artifact, projectRoot: Path) {
        artifact = value; root = projectRoot; index = 0; refresh()
    }
    fun openJson(json: String, artifactPath: String, projectRoot: Path) {
        val valid = ArtifactReader.read(json, artifactPath)
        open(valid, projectRoot)
    }
    fun next() { if (hasNext) { index++; refresh() } }
    fun previous() { if (hasPrevious) { index--; refresh() } }
    fun skipDetails() { skipTarget?.let { select(it.id) } }
    fun select(id: String) {
        val steps = artifact?.steps ?: return
        val target = if (id == "overview") 0 else steps.indexOfFirst { it.id == id } + 1
        if (target == 0 && id != "overview") return
        index = target; refresh()
    }
    fun refresh() {
        if (!active) return
        generation++; clearPresentation(); lastResolution = null
        show(); changed()
    }
    fun changed() { listeners.toList().forEach { it() } }
    fun close() {
        generation++; clearPresentation(); artifact = null; root = null; index = 0; lastResolution = null; changed()
    }
    override fun dispose() { close(); listeners.clear(); show = {}; clearPresentation = {} }
}
