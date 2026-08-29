/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** Reads one handshake framed by either a newline or the legacy Unix EOF. */
export function createHandshakeFrameReader(handle: (raw: string) => void) {
  let buffer = "";
  let handled = false;

  const emit = (raw: string) => {
    if (handled) return;
    handled = true;
    handle(raw);
  };

  return {
    push(chunk: string | Buffer) {
      if (handled) return;
      buffer += chunk.toString();
      const newline = buffer.indexOf("\n");
      if (newline !== -1) emit(buffer.slice(0, newline));
    },
    end() {
      emit(buffer);
    },
  };
}
