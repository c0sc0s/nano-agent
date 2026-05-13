import pc from "picocolors";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export class Spinner {
  #interval: ReturnType<typeof setInterval> | null = null;
  #frameIndex = 0;
  #message = "";
  #stdout: NodeJS.WriteStream;
  #startTime = 0;

  constructor(stdout: NodeJS.WriteStream = process.stdout) {
    this.#stdout = stdout;
  }

  get isRunning(): boolean {
    return this.#interval !== null;
  }

  start(message: string): void {
    this.#message = message;
    this.#frameIndex = 0;
    this.#startTime = Date.now();

    if (this.#interval) return;

    // Write the first frame immediately without an extra blank line.
    this.#draw();
    this.#interval = setInterval(() => {
      this.#frameIndex = (this.#frameIndex + 1) % FRAMES.length;
      this.#draw();
    }, INTERVAL_MS);
  }

  updateMessage(message: string): void {
    this.#message = message;
  }

  /** Stop the spinner and optionally write a final status line. */
  stop(finalMessage?: string): void {
    this.#clear();

    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }

    if (finalMessage) {
      this.#stdout.write(`${finalMessage}\n`);
    } else {
      // Clear whatever was on the line.
      this.#stdout.write("\r\x1b[K");
    }
  }

  /** Stop and replace the spinner line with a success message. */
  succeed(text: string): void {
    const elapsed = Date.now() - this.#startTime;
    this.stop(` ${pc.green("✔")} ${pc.dim(text)} ${pc.dim(`(${(elapsed / 1000).toFixed(1)}s)`)}`);
  }

  /** Stop and replace the spinner line with a failure message. */
  fail(text: string): void {
    this.stop(` ${pc.red("✘")} ${pc.dim(text)}`);
  }

  #draw(): void {
    const elapsed = Date.now() - this.#startTime;
    const elapsedStr = pc.dim(`${(elapsed / 1000).toFixed(1)}s`);
    this.#stdout.write(
      `\r\x1b[K ${pc.cyan(FRAMES[this.#frameIndex])} ${pc.dim(this.#message)}  ${elapsedStr}`,
    );
  }

  #clear(): void {
    this.#stdout.write("\r\x1b[K");
  }
}
