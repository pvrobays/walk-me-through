// GENERATED — Walk Me Through bundle 0.1.0. Source: packages/skill/src/cli.ts and packages/core/src/.

// packages/skill/src/cli.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, statSync as statSync2 } from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// packages/core/src/env.ts
function checkEnvironment(host) {
  const fail = (code, message, hint) => ({ ok: false, errors: [{ code, path: "$", message, hint, recovery: "fix-environment" }] });
  if (Number.parseInt(host.nodeVersion.replace(/^v/, "").split(".")[0], 10) < 20 || !/^v?\d+\./.test(host.nodeVersion)) {
    return fail("NODE_VERSION_UNSUPPORTED", `Node 20 or later is required; found ${host.nodeVersion}.`, "Install Node 20 or later and make node available to the agent, then publish after fixing the environment.");
  }
  let procVersion = "";
  if (host.platform === "linux") {
    try {
      procVersion = host.readText("/proc/version");
    } catch {
    }
  }
  let unsupported;
  if (host.env.WSL_DISTRO_NAME || /microsoft/i.test(procVersion)) unsupported = "WSL";
  else if (host.env.container || host.exists("/.dockerenv") || host.exists("/run/.containerenv")) unsupported = "container";
  else if (host.env.SSH_CONNECTION || host.env.SSH_CLIENT || host.env.SSH_TTY) unsupported = "SSH";
  else if (!["win32", "linux"].includes(host.platform)) unsupported = host.platform;
  const override = host.env.WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT === "1";
  if (unsupported && !override) return fail("ENVIRONMENT_UNSUPPORTED", `Unsupported execution environment: ${unsupported}. Native Windows and native Linux are supported, excluding WSL, SSH, and containers.`, "Run locally on native Windows or native Linux with Node 20+. Report this setup blocker instead of retrying unchanged input.");
  return { ok: true, value: { kind: unsupported ?? "local", platform: host.platform, unsupportedOverride: override }, errors: [] };
}

// packages/core/src/limits.ts
var LIMITS = {
  inputBytes: 1024 * 1024,
  steps: 200,
  title: 200,
  summary: 1e4,
  explanation: 2e4,
  match: 2e3,
  locationLines: 300,
  sourceBytes: 2 * 1024 * 1024,
  depth: 4,
  contextPadding: 10
};

// packages/core/src/publish.ts
import * as fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes as randomBytes2 } from "node:crypto";

// packages/core/src/coords.ts
function offsetToPosition(text, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) throw new RangeError("Offset outside text.");
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  return { line, character: offset - (before.lastIndexOf("\n") + 1) };
}
function positionToOffset(text, position2) {
  const lines = text.split("\n");
  if (!Number.isInteger(position2.line) || !Number.isInteger(position2.character) || position2.line < 0 || position2.line >= lines.length || position2.character < 0 || position2.character > lines[position2.line].length) throw new RangeError("Position outside text.");
  let offset = position2.character;
  for (let i = 0; i < position2.line; i++) offset += lines[i].length + 1;
  return offset;
}
function wholeLineRange(text, startLine, endLine) {
  const lines = text.split("\n");
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine || endLine > lines.length) throw new RangeError("Line range outside text.");
  return { start: { line: startLine - 1, character: 0 }, end: { line: endLine - 1, character: lines[endLine - 1].length } };
}
function comparePositions(a, b) {
  return a.line - b.line || a.character - b.character;
}

// packages/core/src/text.ts
import { createHash } from "node:crypto";
function normalizeText(text) {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}
function decodeText(bytes) {
  if (bytes.includes(0)) throw new Error("Binary file: NUL bytes are not supported.");
  return normalizeText(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
function hashText(text) {
  return createHash("sha256").update(normalizeText(text), "utf8").digest("hex");
}
function occurrences(text, needle) {
  const offsets = [];
  if (!needle.length) return offsets;
  for (let offset = text.indexOf(needle); offset !== -1; offset = text.indexOf(needle, offset + 1)) {
    offsets.push(offset);
  }
  return offsets;
}

// packages/core/src/anchor.ts
function lineAligned(text, start, end) {
  return start >= 0 && end <= text.length && (start === 0 || text[start - 1] === "\n") && (end === text.length || text[end] === "\n");
}
function captureAnchor(text, range) {
  const lines = text.split("\n");
  const selectionStart = positionToOffset(text, range.start);
  const selectionEnd = positionToOffset(text, range.end);
  const selectionText = text.slice(selectionStart, selectionEnd);
  if (!selectionText.trim()) throw new Error("Cannot anchor an empty selection.");
  const matches = occurrences(text, selectionText);
  for (let padding = 0; ; padding++) {
    const startLine = Math.max(0, range.start.line - padding);
    const endLine = Math.min(lines.length - 1, range.end.line + padding);
    const context = lines.slice(startLine, endLine + 1).join("\n");
    const contextStart = positionToOffset(text, { line: startLine, character: 0 });
    const relativeStart = selectionStart - contextStart;
    const count = matches.filter((offset) => {
      const start = offset - relativeStart;
      const end = start + context.length;
      return lineAligned(text, start, end) && text.slice(start, end) === context;
    }).length;
    const unique = count === 1;
    if (unique || padding === LIMITS.contextPadding) return {
      algorithm: "sha256-lf-v1",
      selectionText,
      context: { startLine, lineCount: endLine - startLine + 1, length: context.length, hash: hashText(context), unique },
      selectionInContext: { start: relativeStart, end: selectionEnd - contextStart }
    };
  }
}

// packages/core/src/validation.ts
var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var isInteger = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
var isText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
var isRelativePath = (value) => typeof value === "string" && value.length > 0 && !/[\\\u0000:]/.test(value) && !value.startsWith("/") && value.split("/").every((segment) => segment !== ".." && segment !== "." && segment.length > 0);
function problem(path3, message, code = "INVALID_INPUT", hint = "Correct the named field or type before retrying.") {
  return { code, path: path3, message, hint, recovery: "fix-input" };
}
function unknownFields(object, allowed, path3, errors) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) errors.push(problem(path3 === "$" ? key : `${path3}.${key}`, `Unknown field: ${key}.`));
  }
}

// packages/core/src/artifact.ts
var evidenceValues = ["observation", "hypothesis", "conclusion"];
var position = (v) => isRecord(v) && isInteger(v.line) && isInteger(v.character);
var utcTimestamp = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
function validateLocation(value, path3, errors) {
  const add = (field, message) => errors.push(problem(`${path3}${field}`, message, "INVALID_ARTIFACT"));
  if (!isRecord(value)) {
    add("", "Expected a location object.");
    return;
  }
  if (!isRelativePath(value.path)) add(".path", "Expected a project-relative forward-slash path without escaping segments.");
  const range = value.range;
  const rangeValid = isRecord(range) && position(range.start) && position(range.end);
  if (!rangeValid) add(".range", "Expected nonnegative integer line and character positions.");
  else if (comparePositions(range.start, range.end) >= 0) add(".range", "Range must be nonempty and end after its start.");
  const anchor = value.anchor;
  if (!isRecord(anchor)) {
    add(".anchor", "Expected captured anchor metadata.");
    return;
  }
  if (anchor.algorithm !== "sha256-lf-v1") add(".anchor.algorithm", "Unsupported anchor algorithm.");
  if (typeof anchor.selectionText !== "string" || !anchor.selectionText.trim() || /\r|\u0000/.test(anchor.selectionText) || anchor.selectionText.length > LIMITS.sourceBytes) {
    add(".anchor.selectionText", "Expected nonempty, normalized selection text within the source size limit.");
  }
  const context = anchor.context;
  const contextValid = isRecord(context) && isInteger(context.startLine) && isInteger(context.lineCount, 1) && context.lineCount <= LIMITS.locationLines + 2 * LIMITS.contextPadding && isInteger(context.length, 1) && context.length <= LIMITS.sourceBytes && typeof context.hash === "string" && /^[a-f0-9]{64}$/.test(context.hash) && typeof context.unique === "boolean";
  if (!contextValid) add(".anchor.context", "Expected bounded context line span, UTF-16 length, SHA-256 hash, and unique flag.");
  const selection = anchor.selectionInContext;
  const selectionValid = isRecord(selection) && isInteger(selection.start) && isInteger(selection.end, 1) && selection.end > selection.start && typeof anchor.selectionText === "string" && selection.end - selection.start === anchor.selectionText.length;
  if (!selectionValid || contextValid && selectionValid && selection.end > context.length) add(".anchor.selectionInContext", "Selection offsets must fit context and match the selected text length.");
  if (rangeValid && contextValid) {
    const start = range.start;
    const end = range.end;
    if (end.line - start.line + 1 > LIMITS.locationLines || start.line < context.startLine || end.line >= context.startLine + context.lineCount) add(".range", "Range must fit captured context and the location span limit.");
    if (typeof anchor.selectionText === "string") {
      const lines = anchor.selectionText.split("\n");
      const expectedEndCharacter = lines.length === 1 ? start.character + lines[0].length : lines.at(-1).length;
      if (end.line !== start.line + lines.length - 1 || end.character !== expectedEndCharacter) add(".range", "Range dimensions must match selection text.");
    }
  }
}
function validateArtifact(value) {
  const errors = [];
  const add = (path3, message) => errors.push(problem(path3, message, "INVALID_ARTIFACT"));
  if (!isRecord(value)) return { ok: false, errors: [problem("$", "Expected an artifact object.", "INVALID_ARTIFACT")] };
  if (value.schemaVersion !== 1) add("schemaVersion", "Unsupported schemaVersion. Update the viewer to read this walkthrough.");
  if (!isRecord(value.generator) || value.generator.name !== "walk-me-through" || typeof value.generator.bundleVersion !== "string" || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value.generator.bundleVersion)) add("generator", "Expected generator name and semantic bundle version.");
  if (typeof value.id !== "string" || !/^\d{8}T\d{9}Z-[a-z2-7]{6}$/.test(value.id)) add("id", "Expected a timestamp and six lowercase base32 characters.");
  if (!utcTimestamp(value.createdAt)) add("createdAt", "Expected an ISO-8601 UTC millisecond timestamp.");
  if (!isText(value.title, LIMITS.title)) add("title", `Title must contain 1\u2013${LIMITS.title} characters.`);
  if (!isText(value.summary, LIMITS.summary)) add("summary", `Summary must contain 1\u2013${LIMITS.summary} characters.`);
  const project = value.project;
  if (!isRecord(project) || typeof project.root !== "string" || !/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(project.root)) add("project.root", "Expected an absolute project root.");
  if (!isRecord(project) || !isRecord(project.environment) || !isText(project.environment.kind, 100) || !isText(project.environment.platform, 100) || typeof project.environment.unsupportedOverride !== "boolean") add("project.environment", "Expected environment kind, platform, and unsupportedOverride.");
  if (!isRecord(value.source) || value.source.git !== null && (!isRecord(value.source.git) || typeof value.source.git.commit !== "string" || !/^[a-f0-9]{7,64}$/i.test(value.source.git.commit) || typeof value.source.git.dirty !== "boolean")) add("source.git", "Expected git commit and dirty flag, or null.");
  if (!Array.isArray(value.steps) || value.steps.length === 0 || value.steps.length > LIMITS.steps) {
    add("steps", `Expected 1\u2013${LIMITS.steps} steps.`);
  }
  if (Array.isArray(value.steps)) {
    const steps = value.steps;
    const seen = /* @__PURE__ */ new Map();
    const depths = /* @__PURE__ */ new Map();
    let ancestry = [];
    const parentIds = new Set(steps.filter(isRecord).map((step) => step.parentId).filter((id) => typeof id === "string"));
    steps.forEach((step, i) => {
      const p = `steps[${i}]`;
      if (!isRecord(step)) {
        add(p, "Expected a step object.");
        return;
      }
      if (!isText(step.id, 200)) add(`${p}.id`, "Expected a nonempty step ID.");
      else {
        if (seen.has(step.id)) add(`${p}.id`, "Duplicate step ID.");
        seen.set(step.id, i);
      }
      const parent = step.parentId;
      let depth = 1;
      if (parent !== null && parent !== void 0) {
        if (typeof parent !== "string" || !seen.has(parent) || seen.get(parent) >= i) add(`${p}.parentId`, "Parent must refer to an earlier step; missing, forward, and cyclic parents are invalid.");
        else {
          depth = (depths.get(parent) ?? 1) + 1;
          if (!ancestry.includes(parent)) add(`${p}.parentId`, "Steps must be in depth-first pre-order.");
          ancestry = ancestry.slice(0, ancestry.indexOf(parent) + 1);
        }
      } else ancestry = [];
      if (depth > LIMITS.depth) add(p, `Step exceeds maximum depth ${LIMITS.depth}.`);
      if (typeof step.id === "string") {
        depths.set(step.id, depth);
        ancestry.push(step.id);
      }
      if (!isText(step.title, LIMITS.title)) add(`${p}.title`, `Expected title within ${LIMITS.title} characters.`);
      if (!isText(step.explanation, LIMITS.explanation)) add(`${p}.explanation`, `Expected explanation within ${LIMITS.explanation} characters.`);
      if (step.evidence !== void 0 && !evidenceValues.includes(step.evidence)) add(`${p}.evidence`, "Expected observation, hypothesis, or conclusion.");
      if (step.location === void 0) {
        if (parent !== void 0 && parent !== null && !parentIds.has(step.id)) add(`${p}.location`, "Nested leaf steps require a source location.");
      } else validateLocation(step.location, `${p}.location`, errors);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value, errors: [] };
}

// packages/core/src/ids.ts
import { randomBytes } from "node:crypto";
var alphabet = "abcdefghijklmnopqrstuvwxyz234567";
function walkthroughId(clock = () => /* @__PURE__ */ new Date(), random = randomBytes) {
  const timestamp = clock().toISOString().replace(/[-:.]/g, "");
  const suffix = Array.from(random(6), (byte) => alphabet[byte & 31]).join("");
  return `${timestamp}-${suffix}`;
}
function stepId(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError("Step index must be a nonnegative integer.");
  return `s${index + 1}`;
}

// packages/core/src/input.ts
function validateInput(value) {
  const errors = [];
  if (!isRecord(value)) return { ok: false, errors: [problem("$", "Expected an input object.")] };
  unknownFields(value, ["version", "title", "summary", "steps"], "$", errors);
  if (value.version !== 1) errors.push(problem("version", "Expected input version 1."));
  if (!isText(value.title, LIMITS.title)) errors.push(problem("title", `Expected a nonempty title of at most ${LIMITS.title} characters.`));
  if (!isText(value.summary, LIMITS.summary)) errors.push(problem("summary", `Expected a nonempty summary of at most ${LIMITS.summary} characters.`));
  let count = 0;
  function visit(steps, path3, depth) {
    if (!Array.isArray(steps) || !steps.length) {
      errors.push(problem(path3, "Expected a nonempty steps array."));
      return;
    }
    steps.forEach((step, index) => {
      count++;
      const p = `${path3}[${index}]`;
      if (!isRecord(step)) {
        errors.push(problem(p, "Expected a step object."));
        return;
      }
      unknownFields(step, ["title", "explanation", "evidence", "location", "children"], p, errors);
      if (depth > LIMITS.depth) errors.push(problem(p, `Maximum depth is ${LIMITS.depth}.`));
      if (!isText(step.title, LIMITS.title)) errors.push(problem(`${p}.title`, `Expected a nonempty title of at most ${LIMITS.title} characters.`));
      if (!isText(step.explanation, LIMITS.explanation)) errors.push(problem(`${p}.explanation`, `Expected a nonempty explanation of at most ${LIMITS.explanation} characters.`));
      if (step.evidence !== void 0 && !evidenceValues.includes(step.evidence)) errors.push(problem(`${p}.evidence`, "Expected observation, hypothesis, or conclusion."));
      if (step.location === void 0) {
        if (depth > 1 && !(Array.isArray(step.children) && step.children.length)) errors.push(problem(`${p}.location`, "Nested leaf steps require a source location."));
      } else {
        const loc = step.location;
        const lp = `${p}.location`;
        if (!isRecord(loc)) errors.push(problem(lp, "Expected a location object."));
        else {
          unknownFields(loc, ["path", "startLine", "endLine", "match"], lp, errors);
          if (!isRelativePath(loc.path)) errors.push(problem(`${lp}.path`, "Expected a project-relative forward-slash path without escaping segments."));
          if (!isInteger(loc.startLine, 1)) errors.push(problem(`${lp}.startLine`, "Expected a 1-based positive integer."));
          if (!isInteger(loc.endLine, 1)) errors.push(problem(`${lp}.endLine`, "Expected a 1-based positive integer."));
          if (isInteger(loc.startLine, 1) && isInteger(loc.endLine, 1) && (loc.endLine < loc.startLine || loc.endLine - loc.startLine + 1 > LIMITS.locationLines)) errors.push(problem(lp, `Range must be ordered and span at most ${LIMITS.locationLines} lines.`));
          if (loc.match !== void 0 && (typeof loc.match !== "string" || loc.match.length > LIMITS.match)) errors.push(problem(`${lp}.match`, `Expected exact text of at most ${LIMITS.match} characters.`));
        }
      }
      if (step.children !== void 0) {
        if (depth <= LIMITS.depth) visit(step.children, `${p}.children`, depth + 1);
        else errors.push(problem(`${p}.children`, `Maximum depth is ${LIMITS.depth}.`));
      }
    });
  }
  visit(value.steps, "steps", 1);
  if (count > LIMITS.steps) errors.push(problem("steps", `Maximum step count is ${LIMITS.steps}.`));
  return errors.length ? { ok: false, errors } : { ok: true, value, errors: [] };
}

// packages/core/src/selection.ts
function resolveSelection(location, text, path3 = "location") {
  const lineCount = text.split("\n").length;
  const details = { sourcePath: location.path, startLine: location.startLine, endLine: location.endLine, lineCount };
  const fail = (code, field, message, hint, extra = {}) => ({
    ok: false,
    errors: [{ ...problem(`${path3}${field}`, message, code, hint), details: { ...details, ...extra } }]
  });
  if (location.startLine < 1 || location.endLine < location.startLine || location.endLine > lineCount) {
    return fail("RANGE_OUT_OF_BOUNDS", "", `Requested range is outside the file's ${lineCount} lines.`, "Re-read the current file and correct the range using the reported line count before retrying.");
  }
  const whole = wholeLineRange(text, location.startLine, location.endLine);
  const base = positionToOffset(text, whole.start);
  let start = base;
  let end = positionToOffset(text, whole.end);
  if (location.match !== void 0) {
    const match = normalizeText(location.match);
    if (!match.trim()) return fail("EMPTY_SELECTION", ".match", "The selection is empty or whitespace-only.", "Inspect the current source and choose meaningful code; do not blindly broaden the range. For an eligible narrative/grouping step, remove the location. Retry only after correction.");
    const matches = occurrences(text.slice(start, end), match);
    if (!matches.length) return fail("MATCH_NOT_FOUND", ".match", "The snippet does not occur in the requested lines.", "Re-read the current file and correct the snippet or line range before retrying.");
    if (matches.length > 1) return fail("MATCH_AMBIGUOUS", ".match", "The snippet occurs more than once in the requested lines.", "Use the reported occurrence lines to narrow the range or extend the snippet until unique, then retry.", { occurrenceLines: matches.map((offset) => offsetToPosition(text, base + offset).line + 1) });
    start = base + matches[0];
    end = start + match.length;
  }
  const selectionText = text.slice(start, end);
  if (!selectionText.trim()) return fail("EMPTY_SELECTION", "", "The selection is empty or whitespace-only.", "Inspect the current source and choose meaningful code; do not blindly broaden the range. For an eligible narrative/grouping step, remove the location. Retry only after correction.");
  return { ok: true, value: { range: { start: offsetToPosition(text, start), end: offsetToPosition(text, end) }, selectionText }, errors: [] };
}

// packages/core/src/publish.ts
var nodeIO = {
  realpath: (name) => fs.realpathSync.native(name),
  read: (name) => fs.readFileSync(name),
  size: (name) => fs.statSync(name).size,
  exists: (name) => fs.existsSync(name),
  mkdir: (name) => {
    fs.mkdirSync(name, { recursive: true });
  },
  writeExclusive: (name, text) => fs.writeFileSync(name, text, { flag: "wx", encoding: "utf8" }),
  rename: (from, to) => fs.renameSync(from, to),
  remove: (name) => fs.rmSync(name, { force: true }),
  git: (root) => {
    try {
      const run = (args) => execFileSync("git", args, { cwd: root, timeout: 2e3, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      return { commit: run(["rev-parse", "HEAD"]), dirty: run(["status", "--porcelain"]).length > 0 };
    } catch {
      return null;
    }
  }
};
function resolveRoot(options, io) {
  if (options.root) return io.realpath(path.resolve(options.cwd, options.root));
  const script = io.realpath(options.scriptPath);
  const directory = path.dirname(script);
  const suffix = path.join(".agents", "skills", "walk-me-through", "scripts");
  const compared = options.platform === "win32" ? directory.toLowerCase() : directory;
  if (!compared.endsWith(path.sep + suffix)) throw new Error("Use the installed .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs or supply --root <projectDir>.");
  return io.realpath(directory.slice(0, -(suffix.length + 1)) || path.parse(directory).root);
}
function publish(inputValue, options) {
  const io = options.io ?? nodeIO;
  const fail = (errors2, exitCode = 1) => ({ ok: false, errors: errors2, exitCode });
  let root;
  try {
    root = resolveRoot(options, io);
  } catch (error) {
    return fail([problem("$", String(error), "ROOT_NOT_RESOLVED", "Correct --root or invoke the installed script, then retry after correction.")], 2);
  }
  const input = validateInput(inputValue);
  if (!input.ok) return fail(input.errors);
  const errors = [];
  const steps = [];
  const warnings = [];
  const cache = /* @__PURE__ */ new Map();
  function flatten(items, parentId, field) {
    items.forEach((item, index) => {
      const p = `${field}[${index}]`;
      const id = stepId(steps.length);
      const step = { id, parentId, title: item.title, explanation: item.explanation, ...item.evidence ? { evidence: item.evidence } : {} };
      steps.push(step);
      if (item.location) {
        const location = item.location;
        const details = { sourcePath: location.path, startLine: location.startLine, endLine: location.endLine };
        try {
          const resolved = io.realpath(path.join(root, ...location.path.split("/")));
          const relative = path.relative(root, resolved);
          if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
            errors.push({ ...problem(`${p}.location.path`, "Source realpath escapes the project root.", "SOURCE_OUTSIDE_ROOT", "Choose a source file inside the project root, including after following symlinks."), details });
          } else if (io.size(resolved) > LIMITS.sourceBytes) {
            errors.push({ ...problem(`${p}.location.path`, `Source file exceeds ${LIMITS.sourceBytes} bytes.`, "SOURCE_TOO_LARGE", "Choose a smaller source file within the documented size limit."), details });
          } else {
            let text = cache.get(resolved);
            if (text === void 0) {
              text = decodeText(io.read(resolved));
              cache.set(resolved, text);
            }
            const selection = resolveSelection(location, text, `${p}.location`);
            if (!selection.ok) errors.push(...selection.errors);
            else {
              const anchor = captureAnchor(text, selection.value.range);
              step.location = { path: location.path, range: selection.value.range, anchor };
              if (!anchor.context.unique) warnings.push({ code: "non-unique-anchor", stepId: id, path: `${p}.location` });
            }
          }
        } catch (error) {
          errors.push({ ...problem(`${p}.location.path`, `Cannot read source as UTF-8 text: ${String(error)}`, "SOURCE_UNREADABLE", "Re-read the current source, choose an existing UTF-8 text file inside the root, and correct the path before retrying."), details });
        }
      }
      if (item.children) flatten(item.children, id, `${p}.children`);
    });
  }
  flatten(input.value.steps, null, "steps");
  if (errors.length) return fail(errors);
  const clock = options.clock ?? (() => /* @__PURE__ */ new Date());
  const makeId = options.makeId ?? (() => walkthroughId(clock));
  let git = null;
  try {
    git = io.git(root);
  } catch {
  }
  const artifact = {
    schemaVersion: 1,
    generator: { name: "walk-me-through", bundleVersion: options.bundleVersion },
    id: makeId(),
    createdAt: clock().toISOString(),
    title: input.value.title,
    summary: input.value.summary,
    project: { root, environment: options.environment },
    source: { git },
    steps
  };
  const validated = validateArtifact(artifact);
  if (!validated.ok) return fail(validated.errors.map((error) => ({ ...error, code: "INTERNAL_ERROR", recovery: "report", hint: "Report this tool failure; do not fabricate an artifact or retry unchanged input repeatedly." })), 2);
  const directory = path.join(root, ".walk-me-through", "walkthroughs");
  try {
    io.mkdir(directory);
    const ignore = path.join(root, ".walk-me-through", ".gitignore");
    if (!io.exists(ignore)) {
      try {
        io.writeExclusive(ignore, "*\n");
      } catch (error) {
        if (!io.exists(ignore)) throw error;
      }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) artifact.id = makeId();
      const final = path.join(directory, artifact.id + ".json");
      const lock = final + ".lock";
      try {
        io.writeExclusive(lock, "");
      } catch (error) {
        if (io.exists(lock)) continue;
        throw error;
      }
      const temporary = final + ".tmp-" + randomBytes2(6).toString("hex");
      try {
        if (io.exists(final)) continue;
        io.writeExclusive(temporary, JSON.stringify(artifact, null, 2) + "\n");
        io.rename(temporary, final);
        return {
          ok: true,
          id: artifact.id,
          artifactPath: `.walk-me-through/walkthroughs/${artifact.id}.json`,
          stepCount: steps.length,
          warnings,
          open: `Run Walk Me Through: Open Walkthrough in VS Code and choose "${artifact.title}" (ID ${artifact.id}) in the picker.`
        };
      } finally {
        io.remove(temporary);
        io.remove(lock);
      }
    }
    throw new Error("Unable to allocate a unique walkthrough ID after five attempts.");
  } catch (error) {
    return fail([{ code: "ARTIFACT_WRITE_FAILED", path: "$", message: String(error), hint: "Report the filesystem failure and check write permissions and free space before publishing again.", recovery: "fix-environment" }], 2);
  }
}

// packages/skill/src/cli.ts
function failure(code, message, hint, recovery = "fix-input") {
  return { ok: false, errors: [{ code, path: "$", message, hint, recovery }] };
}
function main() {
  const environment = checkEnvironment({
    nodeVersion: process.versions.node,
    platform: process.platform,
    env: process.env,
    exists: existsSync2,
    readText: (name) => readFileSync2(name, "utf8")
  });
  if (!environment.ok) return { result: { ok: false, errors: environment.errors }, exitCode: 2 };
  const args = process.argv.slice(2);
  let root;
  const usage = () => ({ result: failure("USAGE", "Usage: publish-walkthrough.mjs <input.json> [--root <dir>]", "Supply an input JSON file and optionally an explicit development project root, then retry after correction."), exitCode: 2 });
  if (!args.length || args[0].startsWith("--")) return usage();
  if (args.length !== 1) {
    if (args.length !== 3 || args[1] !== "--root" || !args[2] || args[2].startsWith("--")) return usage();
    root = args[2];
  }
  const inputPath = path2.resolve(args[0]);
  let bytes;
  try {
    if (statSync2(inputPath).size > LIMITS.inputBytes) return { result: failure("INPUT_TOO_LARGE", `Input exceeds ${LIMITS.inputBytes} bytes.`, "Reduce the draft to fit the documented input size limit before retrying."), exitCode: 1 };
    bytes = readFileSync2(inputPath);
  } catch (error) {
    return { result: failure("INPUT_FILE_NOT_FOUND", `Cannot read input file ${inputPath}: ${String(error)}`, "Correct the input path or file permissions before retrying."), exitCode: 2 };
  }
  let value;
  try {
    value = JSON.parse(decodeText(bytes));
  } catch (error) {
    return { result: failure("INVALID_JSON", `Input is not valid UTF-8 JSON: ${String(error)}`, "Correct the JSON syntax or UTF-8 encoding before retrying."), exitCode: 1 };
  }
  const result = publish(value, {
    scriptPath: fileURLToPath(import.meta.url),
    root,
    cwd: process.cwd(),
    platform: process.platform,
    environment: environment.value,
    bundleVersion: "0.1.0"
  });
  if (!result.ok) return { result: { ok: false, errors: result.errors }, exitCode: result.exitCode };
  return { result, exitCode: 0 };
}
try {
  const { result, exitCode } = main();
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = exitCode;
} catch (error) {
  process.stdout.write(JSON.stringify(failure("INTERNAL_ERROR", `Publishing failed internally: ${String(error)}`, "Report this tool failure; do not fabricate an artifact or repeatedly retry unchanged input.", "report")) + "\n");
  process.exitCode = 2;
}
