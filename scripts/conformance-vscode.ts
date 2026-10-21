// Only the VS Code host services used by the real Session class. No traversal is reimplemented.
export class EventEmitter {
  event = () => ({ dispose() {} });
  fire() {}
  dispose() {}
}
export const commands = { async executeCommand() {} };
