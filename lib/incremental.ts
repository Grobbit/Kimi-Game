/**
 * Streaming JSON scanner. The director streams a single JSON object:
 *   {"c":[{...},{...}]}
 * We emit each command object the instant its closing brace arrives, so the
 * world starts changing before the model has finished talking.
 */
export class CommandStream {
  text = "";
  private scan = -1;
  private arrayStart = -1;

  push(chunk: string): Record<string, unknown>[] {
    this.text += chunk;
    const out: Record<string, unknown>[] = [];

    if (this.arrayStart < 0) {
      const key = this.text.indexOf('"c"');
      if (key < 0) return out;
      const lb = this.text.indexOf("[", key);
      if (lb < 0) return out;
      this.arrayStart = lb;
      this.scan = lb + 1;
    }

    let i = this.scan;
    while (i < this.text.length) {
      const ch = this.text[i];
      if (ch === "]") break;
      if (ch !== "{") {
        i++;
        continue;
      }
      const end = matchObject(this.text, i);
      if (end < 0) break;
      const raw = this.text.slice(i, end + 1);
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          out.push(parsed as Record<string, unknown>);
        }
      } catch {
        /* wait for more text */
      }
      i = end + 1;
      this.scan = i;
    }
    return out;
  }

  /** Fallback parse for models that ignore the array wrapper. */
  finalize(): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (let i = this.scan < 0 ? 0 : this.scan; i < this.text.length; i++) {
      if (this.text[i] !== "{") continue;
      const end = matchObject(this.text, i);
      if (end < 0) break;
      try {
        const parsed = JSON.parse(this.text.slice(i, end + 1));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (Array.isArray((parsed as { c?: unknown }).c)) {
            for (const item of (parsed as { c: unknown[] }).c) {
              if (item && typeof item === "object")
                out.push(item as Record<string, unknown>);
            }
          } else if ("k" in parsed) {
            out.push(parsed as Record<string, unknown>);
          }
        }
      } catch {
        /* ignore */
      }
      i = end;
      this.scan = i + 1;
    }
    return out;
  }
}

function matchObject(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
