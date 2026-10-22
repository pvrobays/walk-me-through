package io.github.pvrobays.walkmethrough

import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.vfs.LocalFileSystem
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.util.concurrent.ConcurrentHashMap

data class SkillTarget(val root: Path, val inGit: Boolean)

sealed class InstallOutcome(val kind: String, val skillDir: Path, val message: String) {
    class Installed(skillDir: Path, val created: List<String>, message: String) : InstallOutcome("installed", skillDir, message)
    class AlreadyInstalled(skillDir: Path, message: String) : InstallOutcome("already-installed", skillDir, message)
    class Refused(skillDir: Path, val differing: List<String>, message: String) : InstallOutcome("refused", skillDir, message)
}

/**
 * Installs the bundled project skill. Same algorithm and messages as packages/vscode/src/skill.ts;
 * tests/conformance/skill-install.json keeps both aligned.
 */
object SkillInstaller {
    const val SKILL_DIRECTORY = ".agents/skills/walk-me-through"
    val FILES = listOf("SKILL.md", "manifest.json", "references/walkthrough-format.md", "scripts/publish-walkthrough.mjs")
    const val INSTALLED = "Installed the Walk Me Through skill in {skillDir}. Commit .agents/skills/walk-me-through/ and restart your agent so it discovers the skill."
    const val ALREADY_INSTALLED = "The Walk Me Through skill is already installed in {skillDir}. Nothing was changed."
    const val REFUSED = "The Walk Me Through skill in {skillDir} was left unchanged because these files differ from the bundled version: {files}. Review or remove them, then run Install Skill into Project again."
    const val UNSUPPORTED = "Install Skill into Project needs a local desktop window on native Windows, Linux or macOS. Remote hosts, SSH, WSL and containers are unsupported."

    /** The bundle shipped in the plugin jar under `skill/`. */
    fun bundle(): Map<String, ByteArray> = FILES.associateWith { file ->
        requireNotNull(SkillInstaller::class.java.getResourceAsStream("/skill/$file")) { "The plugin is missing its bundled skill/$file." }.use { it.readBytes() }
    }

    private fun canonical(folder: Path): Path = try { folder.toRealPath() } catch (_: Exception) { folder.toAbsolutePath().normalize() }

    /** Nearest ancestor (or the folder itself) holding a `.git` directory or file; otherwise the folder itself. */
    fun resolveTarget(folder: Path): SkillTarget {
        val start = canonical(folder)
        var current: Path? = start
        while (current != null) {
            if (Files.exists(current.resolve(".git"))) return SkillTarget(current, true)
            current = current.parent
        }
        return SkillTarget(start, false)
    }

    fun key(root: Path, windows: Boolean = LaunchHandling.platformOf(System.getProperty("os.name")) == "win32"): String =
        root.toString().let { if (windows) it.lowercase() else it }

    /** One target per distinct canonical root, in folder order. */
    fun resolveTargets(folders: List<Path>): List<SkillTarget> {
        val seen = mutableSetOf<String>()
        return folders.map(::resolveTarget).filter { seen.add(key(it.root)) }
    }

    fun skillDirectory(root: Path): Path = SKILL_DIRECTORY.split('/').fold(root) { path, part -> path.resolve(part) }
    fun hasSkill(root: Path): Boolean = Files.exists(skillDirectory(root).resolve("SKILL.md"))
    private fun file(directory: Path, name: String): Path = name.split('/').fold(directory) { path, part -> path.resolve(part) }

    private fun same(existing: ByteArray, bundled: ByteArray): Boolean = try {
        SourceText.hash(SourceText.decode(existing)) == SourceText.hash(SourceText.decode(bundled))
    } catch (_: Exception) { false }

    /** Writes only missing files, and nothing at all if any existing file differs after BOM and line-ending normalization. */
    fun install(root: Path, bundle: Map<String, ByteArray> = bundle()): InstallOutcome {
        val skillDir = skillDirectory(root)
        val missing = mutableListOf<String>()
        val differing = mutableListOf<String>()
        for (name in FILES) {
            val destination = file(skillDir, name)
            if (Files.isDirectory(destination)) { differing.add(name); continue }
            val existing = try { Files.readAllBytes(destination) } catch (_: NoSuchFileException) { missing.add(name); continue }
            if (!same(existing, bundle.getValue(name))) differing.add(name)
        }
        if (differing.isNotEmpty()) return InstallOutcome.Refused(skillDir, differing,
            REFUSED.replace("{skillDir}", skillDir.toString()).replace("{files}", differing.joinToString(", ")))
        if (missing.isEmpty()) return InstallOutcome.AlreadyInstalled(skillDir, ALREADY_INSTALLED.replace("{skillDir}", skillDir.toString()))
        for (name in missing) {
            val destination = file(skillDir, name)
            Files.createDirectories(destination.parent)
            Files.write(destination, bundle.getValue(name), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
        }
        return InstallOutcome.Installed(skillDir, missing, INSTALLED.replace("{skillDir}", skillDir.toString()))
    }
}

/** Application-level offer state; never stored in project files. */
interface SkillOfferState {
    var never: Boolean
    var dismissedRoots: List<String>
}

object ApplicationSkillOfferState : SkillOfferState {
    const val NEVER_KEY = "walkMeThrough.skillOffer.never"
    const val DISMISSED_KEY = "walkMeThrough.skillOffer.dismissedRoots"
    private val properties get() = PropertiesComponent.getInstance()
    override var never: Boolean
        get() = properties.getBoolean(NEVER_KEY, false)
        set(value) = properties.setValue(NEVER_KEY, value, false)
    override var dismissedRoots: List<String>
        get() = properties.getList(DISMISSED_KEY) ?: emptyList()
        set(value) = properties.setList(DISMISSED_KEY, value.ifEmpty { null })
}

/** IDE services the onboarding uses, replaceable in tests. */
interface SkillHost {
    fun roots(project: Project): List<Path>
    fun refusal(): String?
    val state: SkillOfferState
    /** Shows a notification; `onChoice` receives the clicked action label. */
    fun notify(project: Project, type: NotificationType, message: String, actions: List<String> = emptyList(), onChoice: (String) -> Unit = {})
    fun pick(project: Project, targets: List<SkillTarget>, onChosen: (SkillTarget) -> Unit)
}

object DefaultSkillHost : SkillHost {
    override fun roots(project: Project): List<Path> = LaunchHandling.projectRoots(project).map(Path::of)
    override fun refusal(): String? = PlaybackEnvironment.currentRefusal()
    override val state: SkillOfferState get() = ApplicationSkillOfferState
    override fun notify(project: Project, type: NotificationType, message: String, actions: List<String>, onChoice: (String) -> Unit) {
        val notification = NotificationGroupManager.getInstance().getNotificationGroup(LaunchProtocolCommand.NOTIFICATION_GROUP)
            .createNotification("Walk Me Through", message, type)
        for (label in actions) notification.addAction(NotificationAction.createSimpleExpiring(label) { onChoice(label) })
        notification.notify(project)
    }
    override fun pick(project: Project, targets: List<SkillTarget>, onChosen: (SkillTarget) -> Unit) {
        JBPopupFactory.getInstance().createPopupChooserBuilder(targets.map { it.root.toString() })
            .setTitle("Install Skill into Project — choose the project")
            .setItemChosenCallback { chosen -> targets.firstOrNull { it.root.toString() == chosen }?.let(onChosen) }
            .createPopup().showCenteredInCurrentWindow(project)
    }
}

object SkillOnboarding {
    const val INSTALL = "Install"
    const val NOT_FOR_PROJECT = "Not for This Project"
    const val NEVER = "Don't Ask Again"

    const val BANNER = "The Walk Me Through skill is not installed in this project, so your AI agent can't create walkthroughs here."

    @Volatile var host: SkillHost = DefaultSkillHost
    /** Roots already offered in this IDE session. */
    private val offered = ConcurrentHashMap.newKeySet<String>()
    /** Called after every install attempt that reached the file system, so tool-window banners can refresh. */
    private val installListeners = java.util.concurrent.CopyOnWriteArrayList<() -> Unit>()

    fun onInstall(listener: () -> Unit): () -> Unit { installListeners.add(listener); return { installListeners.remove(listener) } }

    /** First Git target lacking SKILL.md, ignoring offer dismissals; null where installing is refused. Drives the tool-window banner. */
    fun missingTarget(project: Project): SkillTarget? {
        if (host.refusal() != null) return null
        return SkillInstaller.resolveTargets(host.roots(project)).firstOrNull { it.inGit && !SkillInstaller.hasSkill(it.root) }
    }

    /** Test hook: substitute the host (or restore the default) and forget this session's offers. */
    fun reset(replacement: SkillHost = DefaultSkillHost) { host = replacement; offered.clear() }

    private fun run(project: Project, root: Path): InstallOutcome? = try {
        SkillInstaller.install(root).also { outcome ->
            if (outcome is InstallOutcome.Installed) LocalFileSystem.getInstance().refreshNioFiles(listOf(outcome.skillDir), true, true, null)
            host.notify(project, if (outcome is InstallOutcome.Refused) NotificationType.WARNING else NotificationType.INFORMATION, outcome.message)
            installListeners.forEach { it() }
        }
    } catch (error: java.io.IOException) { failed(project, error) } catch (error: IllegalArgumentException) { failed(project, error) }

    private fun failed(project: Project, error: Exception): InstallOutcome? {
        host.notify(project, NotificationType.ERROR, "Cannot install the Walk Me Through skill: ${error.message ?: error}")
        return null
    }

    /** Walk Me Through: Install Skill into Project. Works after any dismissal. */
    fun install(project: Project, onDone: (InstallOutcome?) -> Unit = {}) {
        if (host.refusal() != null) { host.notify(project, NotificationType.ERROR, SkillInstaller.UNSUPPORTED); onDone(null); return }
        val targets = SkillInstaller.resolveTargets(host.roots(project))
        when {
            targets.isEmpty() -> { host.notify(project, NotificationType.WARNING, "Open a local project folder first, then run Install Skill into Project."); onDone(null) }
            targets.size == 1 -> onDone(run(project, targets[0].root))
            else -> host.pick(project, targets) { onDone(run(project, it.root)) }
        }
    }

    /** Result of an offer attempt: the offered root, or the reason for skipping. */
    data class OfferResult(val root: Path? = null, val skipped: String? = null)

    /** Shows the missing-skill offer for the first eligible Git root of the project, if any. */
    fun offer(project: Project, onChoice: (String, InstallOutcome?) -> Unit = { _, _ -> }): OfferResult {
        if (host.refusal() != null) return OfferResult(skipped = "environment")
        val state = host.state
        if (state.never) return OfferResult(skipped = "never")
        val dismissed = state.dismissedRoots.toSet()
        val target = SkillInstaller.resolveTargets(host.roots(project)).firstOrNull {
            val key = SkillInstaller.key(it.root)
            it.inGit && key !in offered && key !in dismissed && !SkillInstaller.hasSkill(it.root)
        } ?: return OfferResult(skipped = "no-target")
        val key = SkillInstaller.key(target.root)
        offered.add(key)
        val name = target.root.fileName?.toString() ?: target.root.toString()
        host.notify(project, NotificationType.INFORMATION,
            "Coding agents need the Walk Me Through project skill to create walkthroughs for $name. Install it into .agents/skills/walk-me-through/?",
            listOf(INSTALL, NOT_FOR_PROJECT, NEVER)) { choice ->
            when (choice) {
                INSTALL -> onChoice(choice, run(project, target.root))
                NOT_FOR_PROJECT -> { state.dismissedRoots = (state.dismissedRoots + key).distinct(); onChoice(choice, null) }
                NEVER -> { state.never = true; onChoice(choice, null) }
            }
        }
        return OfferResult(root = target.root)
    }
}

class InstallSkillAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT
    override fun update(e: AnActionEvent) { e.presentation.isEnabled = e.project != null }
    override fun actionPerformed(e: AnActionEvent) { SkillOnboarding.install(e.project ?: return) }
}

/** Offers the skill once per project per session after the project opens. */
class SkillOfferActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        if (ApplicationManager.getApplication().isUnitTestMode) return // Platform tests drive SkillOnboarding.offer directly.
        ApplicationManager.getApplication().invokeLater({ if (!project.isDisposed) SkillOnboarding.offer(project) }, project.disposed)
    }
}
