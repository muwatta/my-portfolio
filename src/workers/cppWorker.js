const MAX_OUTPUT = 100000;
const MAX_STEPS = 10000;

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
    if (operator) return { index, operator };
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
    const arrayAccess = expression.match(/^([A-Za-z_]\w*)\[(.+)\]$/);
    if (arrayAccess && this.arrays.has(arrayAccess[1])) {
      return this.arrays.get(arrayAccess[1])[Number(this.evaluate(arrayAccess[2]))] ?? null;
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
      const functionInfo = this.functions.get(functionCall[1]);
      const argumentValues = functionCall[2].trim()
        ? splitTopLevel(functionCall[2], ",").map((argument) => this.evaluate(argument))
        : [];
      const savedValues = new Map();
      functionInfo.params.forEach((parameter, index) => {
        savedValues.set(parameter, this.variables.get(parameter));
        this.variables.set(parameter, argumentValues[index]);
      });
      this.returned = false;
      this.returnValue = null;
      this.runBlock(functionInfo.body);
      const result = this.returnValue;
      functionInfo.params.forEach((parameter) => {
        const saved = savedValues.get(parameter);
        if (saved === undefined) this.variables.delete(parameter);
        else this.variables.set(parameter, saved);
      });
      this.returned = false;
      return result;
    }
    const operators = ["<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "<", ">"];
    const operation = findTopLevel(expression, operators);
    if (operation) {
      const left = expression.slice(0, operation.index).trim();
      const right = expression.slice(operation.index + operation.operator.length).trim();
      const leftValue = this.evaluate(left);
      const rightValue = this.evaluate(right);
      switch (operation.operator) {
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
        default: break;
      }
    }
    if (this.variables.has(expression)) return this.variables.get(expression);
    throw new Error(`This beginner console lab does not support the expression: ${expression}`);
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
    const arrayDeclaration = text.match(/^(?:const\s+)?(?:int|double|float|bool|char|string)\s+([A-Za-z_]\w*)\[\d*\]\s*=\s*\{([^}]*)\}$/);
    if (arrayDeclaration) {
      this.arrays.set(
        arrayDeclaration[1],
        splitTopLevel(arrayDeclaration[2], ",").map((value) => this.evaluate(value)),
      );
      return;
    }
    const arrayAssignment = text.match(/^([A-Za-z_]\w*)\[(\d+)\]\s*=\s*(.+)$/);
    if (arrayAssignment && this.arrays.has(arrayAssignment[1])) {
      const array = this.arrays.get(arrayAssignment[1]);
      array[Number(arrayAssignment[2])] = this.evaluate(arrayAssignment[3]);
      return;
    }
    const declaration = text.match(/^(?:const\s+)?(int|double|float|bool|char|string)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (declaration) {
      this.variables.set(declaration[2], this.evaluate(declaration[3]));
      return;
    }
    const assignment = text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (assignment) {
      if (!this.variables.has(assignment[1])) throw new Error(`Variable ${assignment[1]} is not declared.`);
      this.variables.set(assignment[1], this.evaluate(assignment[2]));
      return;
    }
    if (/^(?:const\s+)?(?:int|double|float|bool|char|string)\s+[A-Za-z_]\w*\s*;$/.test(text)) return;
    throw new Error(`This first console lab does not support this statement: ${text}`);
  }

  runBlock(block) {
    const previous = this.source;
    const previousIndex = this.index;
    this.source = block;
    this.index = 0;
    while (this.index < this.source.length) {
      this.skipSpace();
      if (this.index >= this.source.length || this.source[this.index] === "}") break;
      const rest = this.source.slice(this.index);
      const word = rest.match(/^(if|for|while)\b/);
      if (word) {
        this.index += word[0].length;
        const condition = this.readParenthesized();
        const body = this.readBlock();
        this.tick();
        if (word[1] === "if" && this.evaluate(condition)) this.runBlock(body);
        if (word[1] === "while") {
          while (this.evaluate(condition)) {
            this.runBlock(body);
            this.tick();
          }
        }
        if (word[1] === "for") {
          const parts = splitTopLevel(condition, ";").filter(Boolean);
          this.executeStatement(`${parts[0]};`);
          const limit = 10000;
          let count = 0;
          while (this.evaluate(parts[1])) {
            this.runBlock(body);
            this.executeStatement(`${parts[2]};`);
            count += 1;
            if (count > limit) throw new Error("This for loop ran too many times.");
          }
        }
        this.skipSpace();
        if (this.source.slice(this.index).match(/^else\b/)) {
          this.index += 4;
          const elseBody = this.readBlock();
          if (word[1] === "if" && !this.evaluate(condition)) this.runBlock(elseBody);
        }
        continue;
      }
      this.executeStatement(this.statement());
      if (this.returned) break;
    }
    this.source = previous;
    this.index = previousIndex;
  }

  run(source) {
    let text = cleanSource(source);
    const mainStart = text.match(/int\s+main\s*\([^)]*\)\s*\{/);
    let mainBody = text;
    if (mainStart) {
      const prefix = text.slice(0, mainStart.index);
      mainBody = text.slice(mainStart.index + mainStart[0].length, text.lastIndexOf("}"));
      const functionPattern = /(?:int|double|float|bool|string|void)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g;
      let match = functionPattern.exec(prefix);
      while (match) {
        this.functions.set(match[1], {
          params: splitTopLevel(match[2], ",")
            .filter(Boolean)
            .map((parameter) => parameter.trim().split(/\s+/).pop()),
          body: match[3],
        });
        match = functionPattern.exec(prefix);
      }
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
