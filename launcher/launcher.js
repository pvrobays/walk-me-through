// GENERATED - Walk Me Through launcher. Source: packages/launcher/src/ and packages/core/src/launch.ts. Run npm run build.
"use strict";
(() => {
  // packages/launcher/src/config.ts
  var REPOSITORY_URL = "https://github.com/pvrobays/walk-me-through";
  var VSCODE_MARKETPLACE_URL = "https://marketplace.visualstudio.com/items?itemName=pvrobays.walk-me-through";
  var JETBRAINS_MARKETPLACE_URL = "https://plugins.jetbrains.com/plugin/35375-walk-me-through";
  var IDES = ["vscode", "rider"];
  var IDE_CONFIG = {
    vscode: { label: "VS Code", install: VSCODE_MARKETPLACE_URL },
    rider: { label: "Rider", install: JETBRAINS_MARKETPLACE_URL }
  };
  var PREFERENCE_KEY = "walk-me-through.ide";

  // packages/core/src/validation.ts
  var artifactIdPattern = /^\d{8}T\d{9}Z-[a-z2-7]{6}$/;
  var absolutePathPattern = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;
  var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  var isText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

  // packages/core/src/launch.ts
  var LAUNCH_LIMITS = { encoded: 1536, title: 120, step: 200 };
  var VSCODE_LAUNCH_PREFIX = "vscode://pvrobays.walk-me-through/open?e=";
  var RIDER_LAUNCH_PREFIX = "jetbrains://rider/walkmethrough/open?e=";
  var MESSAGES = {
    empty: "Launch envelope is empty.",
    tooLong: `Launch envelope exceeds ${LAUNCH_LIMITS.encoded} characters.`,
    padding: "Launch envelope must not contain base64 padding.",
    alphabet: "Launch envelope contains characters outside the base64url alphabet.",
    base64: "Launch envelope is not valid unpadded base64url.",
    utf8: "Launch envelope is not valid UTF-8.",
    json: "Launch envelope is not valid JSON.",
    notObject: "Launch envelope must be a JSON object.",
    version: "Unsupported launch envelope version. Update Walk Me Through to open this link."
  };
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  var VALUES = new Map([...ALPHABET].map((c, i) => [c, i]));
  function base64urlDecode(text) {
    if (text.includes("=")) return "padding";
    const values = [];
    for (const c of text) {
      const v = VALUES.get(c);
      if (v === void 0) return "alphabet";
      values.push(v);
    }
    const rest = values.length % 4;
    if (rest === 1) return "base64";
    if (rest === 2 && values[values.length - 1] & 15 || rest === 3 && values[values.length - 1] & 3) return "base64";
    const bytes = new Uint8Array(Math.floor(values.length * 6 / 8));
    let buffer = 0, bits = 0, index = 0;
    for (const v of values) {
      buffer = (buffer << 6 | v) & 16777215;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes[index++] = buffer >> bits & 255;
      }
    }
    return bytes;
  }
  function utf8Decode(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; ) {
      const b = bytes[i];
      let need, cp, min;
      if (b < 128) {
        out += String.fromCharCode(b);
        i++;
        continue;
      } else if (b >= 194 && b <= 223) {
        need = 1;
        cp = b & 31;
        min = 128;
      } else if (b >= 224 && b <= 239) {
        need = 2;
        cp = b & 15;
        min = 2048;
      } else if (b >= 240 && b <= 244) {
        need = 3;
        cp = b & 7;
        min = 65536;
      } else return null;
      if (i + need >= bytes.length) return null;
      for (let k = 1; k <= need; k++) {
        const c = bytes[i + k];
        if ((c & 192) !== 128) return null;
        cp = cp << 6 | c & 63;
      }
      if (cp < min || cp > 1114111 || cp >= 55296 && cp <= 57343) return null;
      out += String.fromCodePoint(cp);
      i += need + 1;
    }
    return out;
  }
  var MEMBERS = ["v", "root", "env", "id", "step", "title"];
  var ENV_MEMBERS = ["kind", "platform"];
  var has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  var nonempty = (value) => typeof value === "string" && value.trim().length > 0;
  function validateEnvelope(value) {
    if (has(value, "v") && typeof value.v === "number" && value.v !== 1) {
      return { ok: false, category: "unsupported-version", problems: [{ path: "v", message: MESSAGES.version }] };
    }
    const problems = [];
    const add = (path, message) => problems.push({ path, message });
    if (value.v !== 1) add("v", "Expected version number 1.");
    if (typeof value.root !== "string" || !absolutePathPattern.test(value.root)) add("root", "Expected an absolute Windows or POSIX project root.");
    const env = value.env;
    if (!isRecord(env)) add("env", "Expected an env object with kind and platform.");
    else {
      if (!nonempty(env.kind)) add("env.kind", "Expected a nonempty environment kind.");
      if (!nonempty(env.platform)) add("env.platform", "Expected a nonempty environment platform.");
      for (const key of Object.keys(env).filter((k) => !ENV_MEMBERS.includes(k)).sort()) add(`env.${key}`, `Unknown member: env.${key}.`);
    }
    if (typeof value.id !== "string" || !artifactIdPattern.test(value.id)) add("id", "Expected an artifact ID: a timestamp and six lowercase base32 characters.");
    if (has(value, "step") && !isText(value.step, LAUNCH_LIMITS.step)) add("step", `Expected a nonempty step ID of at most ${LAUNCH_LIMITS.step} characters.`);
    if (has(value, "title") && (typeof value.title !== "string" || value.title.length > LAUNCH_LIMITS.title)) add("title", `Expected a title of at most ${LAUNCH_LIMITS.title} characters.`);
    for (const key of Object.keys(value).filter((k) => !MEMBERS.includes(k)).sort()) add(key, `Unknown member: ${key}.`);
    if (problems.length) return { ok: false, category: "invalid", problems };
    const fields = env;
    const envelope = { v: 1, root: value.root, env: { kind: fields.kind, platform: fields.platform }, id: value.id };
    if (has(value, "step")) envelope.step = value.step;
    if (has(value, "title")) envelope.title = value.title;
    return { ok: true, envelope };
  }
  function decodeEnvelope(text) {
    const malformed = (message) => ({ ok: false, category: "malformed", problems: [{ path: "$", message }] });
    if (text.length > LAUNCH_LIMITS.encoded) return { ok: false, category: "too-long", problems: [{ path: "$", message: MESSAGES.tooLong }] };
    if (text.length === 0) return malformed(MESSAGES.empty);
    const bytes = base64urlDecode(text);
    if (typeof bytes === "string") return malformed(MESSAGES[bytes]);
    const json = utf8Decode(bytes);
    if (json === null) return malformed(MESSAGES.utf8);
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      return malformed(MESSAGES.json);
    }
    if (!isRecord(parsed)) return malformed(MESSAGES.notObject);
    return validateEnvelope(parsed);
  }
  function vscodeUri(encoded) {
    return VSCODE_LAUNCH_PREFIX + encoded;
  }
  function riderUri(encoded) {
    return RIDER_LAUNCH_PREFIX + encoded;
  }

  // packages/launcher/src/model.ts
  var FRESH_LINK = "Ask your coding agent for a fresh walkthrough link, or open the walkthrough with Walk Me Through: Open Walkthrough in your IDE.";
  function viewFromFragment(hash) {
    const encoded = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!encoded) {
      return { state: "missing", heading: "No walkthrough in this link", message: `This page opens saved walkthroughs from links that include launch data after "#". ${FRESH_LINK}`, problems: [] };
    }
    const result = decodeEnvelope(encoded);
    if (!result.ok) {
      if (result.category === "unsupported-version") {
        return { state: "newer", heading: "This link needs a newer Walk Me Through", message: "The link was produced by a newer Walk Me Through version than this page supports. Reload this page to get the latest launcher, or open the walkthrough with Walk Me Through: Open Walkthrough in your IDE.", problems: result.problems };
      }
      if (result.category === "too-long") {
        return { state: "too-long", heading: "This link is too long", message: `The launch data is longer than walkthrough links allow, so it was not read. ${FRESH_LINK}`, problems: result.problems };
      }
      return { state: "invalid", heading: "This walkthrough link is damaged", message: `The launch data is incomplete or invalid. The link may have been truncated or edited when it was copied. ${FRESH_LINK}`, problems: result.problems };
    }
    const { envelope } = result;
    return {
      state: "ready",
      heading: "Open walkthrough",
      message: "Choose the IDE that has this project open. Nothing opens until you choose.",
      title: envelope.title?.trim() ? envelope.title : envelope.id,
      id: envelope.id,
      root: envelope.root,
      ...envelope.step !== void 0 ? { step: envelope.step } : {},
      hrefs: { vscode: vscodeUri(encoded), rider: riderUri(encoded) },
      problems: []
    };
  }
  function parsePreference(value) {
    return value === "vscode" || value === "rider" ? value : void 0;
  }

  // packages/launcher/src/main.ts
  function byId(dom, id) {
    const element = dom.getElementById(id);
    if (!element) throw new Error(`Launcher markup is missing #${id}`);
    return element;
  }
  function link(element, href) {
    if (href === void 0) element.removeAttribute("href");
    else element.setAttribute("href", href);
  }
  function emphasize(dom, ide) {
    for (const other of IDES) {
      const choice = byId(dom, `open-${other}`);
      choice.classList.toggle("preferred", other === ide);
      if (other === ide) choice.setAttribute("aria-describedby", "status");
      else choice.removeAttribute("aria-describedby");
    }
  }
  function render(view, dom, preference) {
    const ready = view.state === "ready";
    byId(dom, "heading").textContent = view.heading;
    byId(dom, "message").textContent = view.message;
    for (const id of ["details", "choices", "fallback"]) byId(dom, id).hidden = !ready;
    for (const ide of IDES) {
      byId(dom, `help-${ide}`).hidden = true;
      const href = ready ? view.hrefs?.[ide] : void 0;
      link(byId(dom, `open-${ide}`), href);
      link(byId(dom, `retry-${ide}`), href);
      const install = byId(dom, `install-${ide}`);
      install.setAttribute("href", IDE_CONFIG[ide].install);
      install.setAttribute("target", "_blank");
      install.setAttribute("rel", "noopener noreferrer");
    }
    emphasize(dom, ready ? preference : void 0);
    const about = byId(dom, "about");
    about.setAttribute("href", REPOSITORY_URL);
    about.setAttribute("rel", "noopener noreferrer");
    byId(dom, "title").textContent = view.title ?? "";
    byId(dom, "id").textContent = view.id ?? "";
    byId(dom, "copy-text").textContent = view.id ?? "";
    byId(dom, "root").textContent = view.root ?? "";
    byId(dom, "step").textContent = view.step ?? "";
    byId(dom, "step-label").hidden = view.step === void 0;
    byId(dom, "step-value").hidden = view.step === void 0;
    byId(dom, "status").textContent = ready && preference ? `Last time you chose ${IDE_CONFIG[preference].label}.` : "";
    byId(dom, "copy-status").textContent = "";
    const items = view.problems.map((problem) => {
      const item = dom.createElement("li");
      item.textContent = `${problem.path}: ${problem.message}`;
      return item;
    });
    byId(dom, "problem-list").replaceChildren(...items);
    byId(dom, "problems").hidden = items.length === 0;
  }
  function chosen(dom, ide) {
    for (const other of IDES) byId(dom, `help-${other}`).hidden = other !== ide;
    emphasize(dom, ide);
    byId(dom, "status").textContent = `Asked your browser to open ${IDE_CONFIG[ide].label}. If nothing happened, see the help below.`;
  }
  function readPreference() {
    try {
      return parsePreference(window.localStorage.getItem(PREFERENCE_KEY));
    } catch {
      return void 0;
    }
  }
  function savePreference(ide) {
    try {
      window.localStorage.setItem(PREFERENCE_KEY, ide);
    } catch {
    }
  }
  function start() {
    const dom = document;
    const update = () => render(viewFromFragment(window.location.hash), dom, readPreference());
    for (const ide of IDES) {
      for (const id of [`open-${ide}`, `retry-${ide}`]) {
        document.getElementById(id)?.addEventListener("click", () => {
          savePreference(ide);
          chosen(dom, ide);
        });
      }
    }
    document.getElementById("copy-id")?.addEventListener("click", () => {
      const id = document.getElementById("id")?.textContent ?? "";
      const status = document.getElementById("copy-status");
      const fallback = () => {
        const text = document.getElementById("copy-text");
        const range = document.createRange();
        range.selectNodeContents(text);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        status.textContent = "Copying is not available here. The ID is selected; press Ctrl+C (\u2318C on macOS) to copy it.";
      };
      if (!navigator.clipboard?.writeText) {
        fallback();
        return;
      }
      navigator.clipboard.writeText(id).then(() => {
        status.textContent = `Copied ${id}.`;
      }, fallback);
    });
    window.addEventListener("hashchange", update);
    update();
  }
  if (typeof document !== "undefined" && typeof window !== "undefined") start();
})();
