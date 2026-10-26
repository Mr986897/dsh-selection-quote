/**
 * Host half of the selection-quote bundle.
 *
 * The bundle contributes no Host service: the quote pill is rendered by
 * `./client.js`, which registers a frame-wide pill in `shell.overlay` and a
 * headless composer bridge in `conversation.input.overlay`. The Host half
 * exists so the bundle has a valid `apply` export and shows up in the plugin
 * inventory.
 */
export function apply() {}
