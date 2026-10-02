const PRECEDENCE = [
  ["||"],
  ["&&"],
  ["==", "!=", "<=", ">=", "<", ">"],
  ["+", "-"],
  ["*", "/", "%"],
];

const MAX_OUTPUT = 100000;
const MAX_STEPS = 10000;

const HARDWARE_NAMES = [
  "Serial",
  "pinMode",
  "digitalWrite",
  "digitalRead",
  "analogRead",
  "analogWrite",
  "delay",
  "delayMicroseconds",
  "millis",
  "micros",
  "setup",
  "loop",
  "attachInterrupt",
  "tone",
  "noTone",
];

function unsupportedMessage(text) {
  const source = String(text);
  if (/\b(?:struct|class|enum|namespace|template|typedef)\b/.test(source)) {
    return "Structs, classes, enums and templates are not in this console lab yet. This one runs plain statements, decisions, loops, functions and arrays.";
  }
  const hardware = HARDWARE_NAMES.find((name) =>
    new RegExp(`\\b${name}\\s*\\(`).test(source),
  );
  if (hardware || /^\s*#/.test(source) || /\bServo\b|\bchar\s*\*/.test(source)) {
    return `${hardware ? hardware + "()" : "This line"} talks to hardware, so it cannot run in a browser. Try the logic part on its own, with the sensor values written in as numbers.`;
  }
  const missingCall = source.match(/^([A-Za-z_]\w*)\s*\(/);
  if (missingCall) {
    return `${missingCall[1]}() is not defined in this snippet. In a real sketch it would come from a library or from earlier in the file, so add the function above, or write in the value it would return.`;
  }
  return `This first console lab does not support this statement: ${source}`;
}

function cleanSource(source) {
  return String(source ?? "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*#.*$/gm, "")
    .replace(/using\s+namespace\s+std\s*;/g, "")
    .replace(/std::/g, "");
}

function splitTopLevel(value, separator) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth -= 1;
    const matchesSeparator = separator
      ? value.slice(index, index + separator.length) === separator
      : false;
    if (matchesSeparator && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + separator.length;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function findTopLevel(value, operators) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === ")" || character === "]" || character === "}") depth += 1;
    if (character === "(" || character === "[" || character === "{") depth -= 1;
    if (depth !== 0) continue;
    const operator = operators.find((item) => value.slice(index, index + item.length) === item);
    if (!operator) continue;
    if (operator === "+" || operator === "-") {
      const before = value.slice(0, index).replace(/\s+$/, "");
      if (before === "" || /[+\-*/%<>=!(&|,]$/.test(before)) continue;
    }
    return { index, operator };
  }
  return null;
}

function parseArrayAccess(expression) {
  const match = expression.match(/^([A-Za-z_]\w*)\[/);
  if (!match) return null;
  let depth = 1;
  let index = match[0].length;
  for (; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return index === expression.length - 1
          ? { name: match[1], index: expression.slice(match[0].length, index) }
          : null;
      }
    }
  }
  return null;
}

class BeginnerCpp {
  constructor() {
    this.variables = new Map();
    this.arrays = new Map();
    this.functions = new Map();
    this.returned = false;
    this.returnValue = null;
    this.output = [];
    this.outputLength = 0;
    this.steps = 0;
    this.index = 0;
  }

  tick() {
    this.steps += 1;
    if (this.steps > MAX_STEPS) {
      throw new Error("This program ran too many steps. Check the loop condition.");
    }
  }

  callFunction(name, argumentSource) {
    const functionInfo = this.functions.get(name);
    const argumentValues = argumentSource.trim()
      ? splitTopLevel(argumentSource, ",").map((argument) => this.evaluate(argument))
      : [];
    const savedValues = new Map();
    functionInfo.params.forEach((parameter, index) => {
      savedValues.set(parameter, this.variables.get(parameter));
      this.variables.set(parameter, argumentValues[index]);
    });
    const outerReturned = this.returned;
    const outerReturnValue = this.returnValue;
    this.returned = false;
    this.returnValue = null;
    this.runBlock(functionInfo.body);
    const result = this.returnValue;
    functionInfo.params.forEach((parameter) => {
      const saved = savedValues.get(parameter);
      if (saved === undefined) this.variables.delete(parameter);
      else this.variables.set(parameter, saved);
    });
    this.returned = outerReturned;
    this.returnValue = outerReturnValue;
    return result;
  }

  evaluate(rawExpression) {
    let expression = String(rawExpression ?? "").trim();
    while (expression.startsWith("(") && expression.endsWith(")")) {
      const parts = splitTopLevel(expression.slice(1, -1), "");
      if (parts.length === 1) expression = parts[0].trim();
      else break;
    }
    if (/^".*"$/.test(expression) || /^'.*'$/.test(expression)) {
      return expression.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    }
    if (expression === "true") return true;
    if (expression === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(expression)) return Number(expression);
    if (expression.startsWith("!")) return !this.evaluate(expression.slice(1));
    if (/^-\s*[\w(]/.test(expression) && !/^-[\s\d.]/.test(expression.slice(1))) {
      return -this.evaluate(expression.slice(1));
    }
    const arrayAccess = parseArrayAccess(expression);
    if (arrayAccess && this.arrays.has(arrayAccess.name)) {
      return this.arrays.get(arrayAccess.name)[Number(this.evaluate(arrayAccess.index))] ?? null;
    }
    if (expression.endsWith("++") || expression.endsWith("--")) {
      const variable = expression.slice(0, -2).trim();
      const current = Number(this.variables.get(variable) ?? 0);
      return expression.endsWith("++") ? current + 1 : current - 1;
    }
    const arrayDeclaration = expression.match(/^([A-Za-z_]\w*)\[(\d*)\]$/);
    if (arrayDeclaration && this.variables.has(arrayDeclaration[1])) return;
    const functionCall = expression.match(/^([A-Za-z_]\w*)\((.*)\)$/);
    if (functionCall && this.functions.has(functionCall[1])) {
      return this.callFunction(functionCall[1], functionCall[2]);
    }
    const question = findTopLevel(expression, ["?"]);
    if (question) {
      const condition = expression.slice(0, question.index).trim();
      const rest = expression.slice(question.index + 1);
      const colon = findTopLevel(rest, [":"]);
      if (colon) {
        const whenTrue = rest.slice(0, colon.index).trim();
        const whenFalse = rest.slice(colon.index + 1).trim();
        return this.evaluate(condition)
          ? this.evaluate(whenTrue)
          : this.evaluate(whenFalse);
      }
    }

    for (const level of PRECEDENCE) {
      const operation = findTopLevel(expression, level);
      if (!operation) continue;
      const left = expression.slice(0, operation.index).trim();
      const right = expression.slice(operation.index + operation.operator.length).trim();
      if (!left || !right) continue;
      return this.applyOperator(operation.operator, this.evaluate(left), this.evaluate(right));
    }
    if (this.variables.has(expression)) return this.variables.get(expression);
    throw new Error(`This beginner console lab does not support the expression: ${expression}`);
  }

  applyOperator(operator, leftValue, rightValue) {
    switch (operator) {
      case "+": return typeof leftValue === "string" || typeof rightValue === "string" ? `${leftValue}${rightValue}` : leftValue + rightValue;
      case "-": return leftValue - rightValue;
      case "*": return leftValue * rightValue;
      case "/": return leftValue / rightValue;
      case "%": return leftValue % rightValue;
      case "<": return leftValue < rightValue;
      case ">": return leftValue > rightValue;
      case "<=": return leftValue <= rightValue;
      case ">=": return leftValue >= rightValue;
      case "==": return leftValue === rightValue;
      case "!=": return leftValue !== rightValue;
      case "&&": return Boolean(leftValue && rightValue);
      case "||": return Boolean(leftValue || rightValue);
      default:
        return undefined;
    }
  }

  emit(value) {
    const text = value === "endl" ? "\n" : String(value);
    if (this.outputLength >= MAX_OUTPUT) return;
    const remaining = MAX_OUTPUT - this.outputLength;
    this.output.push(text.slice(0, remaining));
    this.outputLength += Math.min(text.length, remaining);
  }

  skipSpace() {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) this.index += 1;
  }

  readParenthesized() {
    const start = this.source.indexOf("(", this.index);
    if (start < 0) throw new Error("Missing opening parenthesis.");
    let depth = 0;
    let quote = null;
    for (let index = start; index < this.source.length; index += 1) {
      const character = this.source[index];
      if (quote) {
        if (character === quote && this.source[index - 1] !== "\\") quote = null;
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          const value = this.source.slice(start + 1, index);
          this.index = index + 1;
          return value;
        }
      }
    }
    throw new Error("Missing closing parenthesis.");
  }

  readBlock() {
    this.skipSpace();
    if (this.source[this.index] !== "{") throw new Error("Missing opening brace.");
    const start = ++this.index;
    let depth = 1;
    let quote = null;
    for (let index = start; index < this.source.length; index += 1) {
      const character = this.source[index];
      if (quote) {
        if (character === quote && this.source[index - 1] !== "\\") quote = null;
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      if (character === "{") depth += 1;
      if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const value = this.source.slice(start, index);
          this.index = index + 1;
          return value;
        }
      }
    }
    throw new Error("Missing closing brace.");
  }

  readBody() {
    this.skipSpace();
    if (this.source[this.index] === "{") return this.readBlock();
    return this.statement();
  }

  runElseChain(execute = true) {
    this.skipSpace();
    const rest = this.source.slice(this.index);
    const elseIf = rest.match(/^else\s+if\b/);
    if (elseIf) {
      this.index += elseIf[0].length;
      const condition = this.readParenthesized();
      const body = this.readBody();
      this.tick();
      if (!execute) {
        this.runElseChain(false);
        return { returned: false, broke: false };
      }
      if (this.evaluate(condition)) {
        const outcome = this.runBlock(body);
        this.runElseChain(false);
        return outcome;
      }
      return this.runElseChain();
    }
    const plainElse = rest.match(/^else\b/);
    if (plainElse) {
      this.index += plainElse[0].length;
      const body = this.readBody();
      this.tick();
      if (execute) return this.runBlock(body);
    }
    return { returned: false, broke: false };
  }

  statement() {
    this.skipSpace();
    const start = this.index;
    let depth = 0;
    let quote = null;
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (quote) {
        if (character === quote && this.source[this.index - 1] !== "\\") quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if ("([{".includes(character)) {
        depth += 1;
      } else if (")]}".includes(character)) {
        depth -= 1;
      } else if (character === ";" && depth === 0) {
        this.index += 1;
        return this.source.slice(start, this.index - 1).trim();
      }
      this.index += 1;
    }
    if (start < this.index) return this.source.slice(start, this.index).trim();
    return "";
  }

  executeStatement(statement) {
    this.tick();
    const text = statement.trim().replace(/;$/, "");
    if (!text || text.startsWith("//")) return;
    if (text.startsWith("return")) {
      const value = text.replace(/^return\s*/, "").replace(/;\s*$/, "").trim();
      this.returned = true;
      this.returnValue = value ? this.evaluate(value) : null;
      return;
    }
    if (text.startsWith("cin")) throw new Error("Input is not available in this first console lab yet.");
    const statementCall = text.match(/^([A-Za-z_]\w*)\s*\((.*)\)$/);
    if (statementCall && this.functions.has(statementCall[1])) {
      this.callFunction(statementCall[1], statementCall[2]);
      return;
    }
    const update = text.match(/^([A-Za-z_]\w*)\s*(\+\+|--)$/);
    if (update && this.variables.has(update[1])) {
      this.variables.set(update[1], Number(this.variables.get(update[1])) + (update[2] === "++" ? 1 : -1));
      return;
    }
    if (text.startsWith("cout")) {
      const expression = text.replace(/^cout\s*<</, "").replace(/;\s*$/, "");
      const values = splitTopLevel(expression, "<<");
      values.forEach((value) => {
        const item = value.trim();
        if (item === "endl") this.emit("endl");
        else if (item) this.emit(this.evaluate(item));
      });
      return;
    }
    const arrayDeclaration = text.match(/^(?:const\s+)?(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string)\s+([A-Za-z_]\w*)\[\d*\]\s*=\s*\{([^}]*)\}$/);
    if (arrayDeclaration) {
      this.arrays.set(
        arrayDeclaration[1],
        splitTopLevel(arrayDeclaration[2], ",").map((value) => this.evaluate(value)),
      );
      return;
    }
    const arraySizing = text.match(/^(?:const\s+)?(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string)\s+([A-Za-z_]\w*)\[(\d+)\]\s*$/);
    if (arraySizing) {
      this.arrays.set(arraySizing[1], new Array(Number(arraySizing[2])).fill(0));
      return;
    }
    const arrayAssignment = parseArrayAccess(text.match(/^(.+?)\s*=\s*([\s\S]+)$/)?.[1] ?? "");
    if (arrayAssignment && this.arrays.has(arrayAssignment.name)) {
      const value = text.match(/^(.+?)\s*=\s*([\s\S]+)$/)[2];
      const array = this.arrays.get(arrayAssignment.name);
      array[Number(this.evaluate(arrayAssignment.index))] = this.evaluate(value);
      return;
    }
    const declaration = text.match(/^(?:const\s+)?((?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string))\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (declaration) {
      this.variables.set(declaration[2], this.evaluate(declaration[3]));
      return;
    }
    const compound = text.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=|%=)\s*(.+)$/);
    if (compound) {
      if (!this.variables.has(compound[1])) {
        throw new Error(`Variable ${compound[1]} is not declared.`);
      }
      const current = Number(this.variables.get(compound[1]));
      const value = Number(this.evaluate(compound[3]));
      switch (compound[2]) {
        case "+=": this.variables.set(compound[1], current + value); break;
        case "-=": this.variables.set(compound[1], current - value); break;
        case "*=": this.variables.set(compound[1], current * value); break;
        case "/=": this.variables.set(compound[1], current / value); break;
        default: this.variables.set(compound[1], current % value); break;
      }
      return;
    }
    const assignment = text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignment) {
      if (!this.variables.has(assignment[1])) throw new Error(`Variable ${assignment[1]} is not declared.`);
      this.variables.set(assignment[1], this.evaluate(assignment[2]));
      return;
    }
    if (/^(?:const\s+)?(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string)\s+[A-Za-z_]\w*$/.test(text)) {
      const bare = text.match(/([A-Za-z_]\w*)$/);
      if (bare && !this.variables.has(bare[1])) this.variables.set(bare[1], 0);
      return;
    }
    throw new Error(unsupportedMessage(text));  }

  runBlock(block) {
    const previous = this.source;
    const previousIndex = this.index;
    this.source = block;
    this.index = 0;
    let broke = false;
    while (this.index < this.source.length) {
      this.skipSpace();
      if (this.index >= this.source.length || this.source[this.index] === "}") break;
      const rest = this.source.slice(this.index);
      if (rest.match(/^break\b/)) {
        broke = true;
        break;
      }
      if (rest.match(/^do\b/)) {
        this.index += 2;
        const doBody = this.readBody();
        this.tick();
        this.skipSpace();
        const whileMatch = this.source.slice(this.index).match(/^while\b/);
        if (!whileMatch) throw new Error("A do block must end with while (...).");
        this.index += whileMatch[0].length;
        const doCondition = this.readParenthesized();
        this.skipSpace();
        if (this.source[this.index] === ";") this.index += 1;
        this.runBlock(doBody);
        while (this.evaluate(doCondition)) {
          this.runBlock(doBody);
          this.tick();
          if (this.returned) break;
        }
        if (this.returned) break;
        continue;
      }
      const word = rest.match(/^(if|for|while|switch)\b/);
      if (word) {
        this.index += word[0].length;
        const condition = this.readParenthesized();
        this.tick();
        if (word[1] === "switch") {
          const outcome = this.runSwitch(condition);
          if (outcome.returned || outcome.broke) {
            broke = outcome.broke;
            break;
          }
          continue;
        }
        const body = this.readBody();
        if (word[1] === "if") {
          const taken = this.evaluate(condition);
          const outcome = taken ? this.runBlock(body) : this.runElseChain();
          if (outcome.returned || outcome.broke) {
            broke = outcome.broke;
            break;
          }
          if (taken) this.runElseChain(false);
        } else if (word[1] === "while") {
          while (this.evaluate(condition)) {
            const outcome = this.runBlock(body);
            if (outcome.returned || outcome.broke) {
              broke = outcome.broke;
              break;
            }
            this.tick();
          }
          if (broke || this.returned) break;
        } else {
          const parts = splitTopLevel(condition, ";").filter(Boolean);
          this.executeStatement(`${parts[0]};`);
          const limit = 10000;
          let count = 0;
          while (this.evaluate(parts[1])) {
            const outcome = this.runBlock(body);
            if (outcome.returned || outcome.broke) {
              broke = outcome.broke;
              break;
            }
            this.executeStatement(`${parts[2]};`);
            count += 1;
            if (count > limit) throw new Error("This for loop ran too many times.");
          }
          if (broke || this.returned) break;
        }
        continue;
      }
      this.executeStatement(this.statement());
      if (this.returned) break;
    }
    this.source = previous;
    this.index = previousIndex;
    return { returned: this.returned, broke };
  }

  readBracedBlockAt(text, braceIndex) {
    let depth = 0;
    let quote = null;
    for (let index = braceIndex; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (character === quote && text[index - 1] !== "\\") quote = null;
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      if (character === "{") depth += 1;
      if (character === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(braceIndex + 1, index);
      }
    }
    return text.slice(braceIndex + 1);
  }

  runSwitch(subjectExpression) {
    const subject = this.evaluate(subjectExpression);
    this.skipSpace();
    if (this.source[this.index] !== "{") {
      throw new Error("Missing opening brace after switch.");
    }
    const body = this.readBlock();
    const cases = [];
    const pattern = /case\s+(.+?)\s*:|default\s*:/g;
    let match = pattern.exec(body);
    while (match) {
      cases.push({
        label: match[0].startsWith("default") ? "default" : match[1].trim(),
        labelStart: match.index,
        start: match.index + match[0].length,
        isDefault: match[0].startsWith("default"),
      });
      match = pattern.exec(body);
    }
    let outcome = { returned: false, broke: false };
    let entered = false;
    for (let index = 0; index < cases.length; index += 1) {
      const current = cases[index];
      const next = cases[index + 1];
      const end = next ? next.labelStart : body.length;
      const chunk = body.slice(current.start, end);
      if (!entered) {
        if (
          !current.isDefault &&
          String(subject) !== String(this.evaluate(current.label))
        ) {
          continue;
        }
        entered = true;
      }
      outcome = this.runBlock(chunk);
      if (outcome.returned || outcome.broke) break;
    }
    return outcome;
  }

  run(source) {
    const text = cleanSource(source);
    if (/\b(?:struct|class|enum|namespace|template|typedef)\b/.test(text)) {
      throw new Error(unsupportedMessage("struct"));
    }
    const functionPattern = /(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string|void)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    const mainStart = text.match(/int\s+main\s*\([^)]*\)\s*\{/);
    let mainBody = text;

    if (mainStart) {
      mainBody = this.readBracedBlockAt(text, mainStart.index + mainStart[0].length - 1);
    }

    let match = functionPattern.exec(text);
    while (match) {
      if (match[1] !== "main") {
        this.functions.set(match[1], {
          params: splitTopLevel(match[2], ",")
            .filter(Boolean)
            .map((parameter) => parameter.trim().split(/\s+/).pop()),
          body: this.readBracedBlockAt(text, match.index + match[0].length - 1),
        });
      }
      match = functionPattern.exec(text);
    }
    this.source = mainBody;
    this.runBlock(this.source);
    let result = this.output.join("");
    if (this.outputLength >= MAX_OUTPUT) result += "\n\nOutput limit reached. Only the first 100,000 characters are shown.";
    return result || "Program finished with no output.";
  }
}

self.onmessage = (event) => {
  if (event.data?.type !== "run") return;
  try {
    const result = new BeginnerCpp().run(event.data.code);
    self.postMessage({ type: "result", id: event.data.id, output: result });
  } catch (error) {
    self.postMessage({ type: "error", id: event.data.id, message: error?.message || "C++ program failed." });
  }
};
