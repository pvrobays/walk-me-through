# Walk Me Through for VS Code

Walk Me Through plays code-anchored walkthroughs that your coding agent publishes for the current project. Instead of pasting code excerpts into its reply, the agent saves a walkthrough and gives you one link. VS Code then takes you through the explanation step by step, next to the highlighted code.

## Get started

1. Install this extension in the desktop VS Code that you normally start, so it handles `vscode://` links.
2. Open your project, then run **Walk Me Through: Install Skill into Project** from the Command Palette. It copies the project skill shipped inside this extension into `.agents/skills/walk-me-through/` at the project's Git root. It needs no network, Node or clone of the Walk Me Through repository.
3. Commit `.agents/skills/walk-me-through/` and restart your agent (for example OpenCode) so it discovers the skill.
4. Ask the agent to explain something that spans several files. Its reply starts with a link: click it and choose **Open in VS Code**.

## The project skill

Your agent needs the skill to create walkthroughs; the extension only plays them.

- **Install Skill into Project** adds only missing files. If a skill file already exists with different content, for example a customized `SKILL.md`, it changes nothing and names that file. With several workspace folders in different repositories, you choose one.
- **Offer:** when you open a trusted Git project without the skill, a notification offers **Install**, **Not for This Project** (no more offers for that repository) and **Don't Ask Again** (no more offers anywhere). These choices are stored in VS Code's own extension state, never in your project. The offer is not shown in Restricted Mode, but the command still works there.
- **Banner:** while the skill is missing, the Walk Me Through view shows a banner at its top saying your AI agent can't create walkthroughs here, with an **Install Skill** button. The banner ignores the choices above, so it is how you get back after dismissing the offer. There is no separate reset.

## Reading a walkthrough

Open the **Walk Me Through** view in the Activity Bar. **Steps** shows the outline; **Step** shows the explanation with **Previous**, **Next** and **Skip Details**. The current code is highlighted and explained inline in a comment beside it. Use **Walk Me Through: Open Walkthrough** to choose a saved walkthrough by title or ID, and **Walk Me Through: Return to Current Step** after browsing elsewhere.

When the code has changed since the walkthrough was written, the step says so: moved code is followed, uncertain matches are marked, and missing code is reported instead of highlighting something else.

## Launch links

The agent's link opens a launcher page where you choose VS Code or Rider. VS Code receives `vscode://pvrobays.walk-me-through/open?e=…` and opens the walkthrough only in a window that already has the recorded project open. It never opens folders or runs anything. A link for a project that is not open, or one published on another platform, only shows a notice.

## Platforms and privacy

- Local desktop VS Code on native Windows, Linux or macOS. Windows is tested by the maintainers; Linux and macOS are supported but not verified by the maintainers (automated CI runs on both).
- Not supported: WSL, SSH and other remote extension hosts, and containers.
- Walkthroughs are JSON files in the project's `.walk-me-through/` folder, which ignores itself in Git. The extension makes no network requests of its own and collects no telemetry; web links in explanations open in your browser only when you click them.

## More

- [Project README and Rider plugin](https://github.com/pvrobays/walk-me-through#readme)
- [How it works](https://github.com/pvrobays/walk-me-through/blob/main/how-it-works.md)
- [Issues](https://github.com/pvrobays/walk-me-through/issues)
