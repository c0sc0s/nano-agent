const OUTPUT_LIMIT = 50_000;

export function truncateOutput(output: string): string {
  return output.length > OUTPUT_LIMIT ? output.slice(0, OUTPUT_LIMIT) : output;
}
