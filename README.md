# Walk Me Through

> **“Moving the code context out of the model’s output and into the IDE, where it already exists.”**

## The problem

When a coding agent explores code or investigates a bug, its answer is usually a trail of references to small pieces of code across several files. Either you open every file, find each line, and piece the story together yourself, or the agent pastes large excerpts. Those excerpts cost tokens and repeat code you already have locally.

Walk Me Through gets that context from the agent to you **as quickly and with as little friction as possible**. The agent publishes a walkthrough, you click one link, and your IDE takes you through the explanation step by step, next to the highlighted code. You don't copy anything, search for lines, or reconstruct the connections.

![A walkthrough in VS Code: the step outline on the left, the explanation inline beside the highlighted source](docs/images/vscode-walkthrough.png)

## Try it

Requirements: Node 20+ and a desktop IDE on native Windows or Linux (not WSL, SSH, or containers).

### Install the VS Code extension

Preferred: install **[Walk Me Through](https://marketplace.visualstudio.com/items?itemName=pvrobays.walk-me-through)** from the VS Code Marketplace. In VS Code, search for `walk-me-through` in the Extensions view, or run:

```sh
code --install-extension pvrobays.walk-me-through
```

Install it into the desktop VS Code that you normally start, so that it owns the `vscode://` link handler.

Alternatively, build a VSIX from this repository:

```sh
npm install
npm run package:vsix
code --install-extension packages/vscode/walk-me-through-0.1.0.vsix
```

### Install the Rider plugin

The Rider plugin is a development build for native Windows Rider 2026.2.3.1 only.

1. Build the ZIP as described in [Rider development](packages/rider/README.md#windows-build-sandbox-and-install). It is written to `packages/rider/build/distributions/`.
2. In Rider, open **Settings → Plugins → gear → Install Plugin from Disk…**, select the ZIP, and restart Rider.
3. Install **JetBrains Toolbox** if you don't have it. It handles `jetbrains://` links.

### Add the skill to your project and ask

```sh
git clone https://github.com/pvrobays/walk-me-through
cd walk-me-through
npm run skill:install -- <your-project-dir>
```

This copies the skill into `<your-project-dir>/.agents/skills/walk-me-through/`. Commit it so teammates get it too, then **restart OpenCode** in your project. Open the project in your IDE, then ask the agent to explain something that spans several files. Its reply starts with a link: click it, choose **Open in VS Code** or **Open in Rider**, and step through the walkthrough.

## Learn more

- [How it works](how-it-works.md): publishing, reading a walkthrough, changed code, links, and current limits.
- [IMPLEMENTATION.md](IMPLEMENTATION.md): design principles, MVP scope, roadmap, development setup, status, and related work.

## License

[MIT](LICENSE).
