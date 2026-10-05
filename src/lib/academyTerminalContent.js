const INSTRUCTION_COMMENT =
  /^\s*(?:#|\/\/|\/\*|\*)\s*(?:TODO|TASK|INSTRUCTION)\s*:?\s*(.*)$/i;

export function separateTerminalInstructions(source = "") {
  const instructions = [];
  const code = String(source)
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(INSTRUCTION_COMMENT);
      if (!match) return true;
      instructions.push(match[1].trim());
      return false;
    })
    .join("\n");

  return { code, instructions };
}
