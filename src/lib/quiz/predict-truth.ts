/** Name of the exception in a trimmed traceback: the last line of the form `Name: message`. */
export function exceptionName(errorText: string): string | undefined {
  const lines = errorText.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^([A-Za-z_][\w.]*(?:Error|Exception|Exit|Interrupt|Warning)|StopIteration)\b/.exec(
      lines[i] ?? '',
    );
    if (m) return m[1]?.split('.').pop();
  }
  return undefined;
}

/**
 * Ground truth for a predict item (SPEC §7): the printed output; if the code raises, any printed
 * output followed by the exception's type name on its own line.
 */
export function expectedOutput(stdout: string, error: string | undefined): string {
  if (error === undefined) return stdout.replace(/\s+$/, '');
  const name = exceptionName(error) ?? 'Exception';
  const printed = stdout.replace(/\s+$/, '');
  return printed === '' ? name : `${printed}\n${name}`;
}
