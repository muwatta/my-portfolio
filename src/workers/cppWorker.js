// Loosest first. findTopLevel returns the rightmost match, so splitting a level
// at a time parses each level left to right, which is the associativity C++ uses.
const PRECEDENCE = [
  ["||"],
  ["&&"],
  ["==", "!=", "<=", ">=", "<", ">"],
  ["+", "-"],
  ["*", "/", "%"],
];

const MAX_OUTPUT = 100000;
const MAX_STEPS = 10000;

// Arduino and other hardware sketches cannot run in a browser console lab. Saying
// so is more use to a student than "unsupported statement", which reads as their
// code being wrong when in fact it needs a board.
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

// Types the interpreter genuinely cannot model, checked before parsing so a
// sketch fails with an explanation rather than being silently skipped and
// reported as "Program finished with no output", which is indistinguishable from
// a program that correctly printed nothing.
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
  // A call to something the snippet never defined is usually a helper from an
  // Arduino sketch. Saying so is more use than "unsupported statement".
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
    // A + or - with nothing meaningful before it is a sign, not an operation.
    // Without this, `value * -1` split at the sign and tried to evaluate
    // `value *`, which then failed as an unknown expression.
    if (operator === "+" || operator === "-") {
      const before = value.slice(0, index).replace(/\s+$/, "");
      if (before === "" || /[+\-*/%<>=!(&|,]$/.test(before)) continue;
    }
    return { index, operator };
  }
  return null;
}

// Returns { name, index } for `name[...]`, or null. The closing bracket is found
// by counting rather than by a greedy regex, because `centre[step] < left[step]`
// otherwise matched with the whole comparison swallowed as the index.
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

  // Runs a user-defined function and returns whatever it returned. Extracted from
  // the expression evaluator so a call can also stand alone as a statement, which
  // is how every void function is used: `greet();`. That form was previously
  // parsed as a variable that did not exist.
  //
  // The return flag is saved and restored rather than cleared, so a `return`
  // inside a function no longer ends the whole program.
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
    // Unary minus, so `x * -1` works. It is the standard way to make a value
    // positive again, and it appeared in the course content as `value * -1`.
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
    // The conditional operator, tightest of all, so it is handled before the
    // binary levels. `kept > 0 ? total / kept : 0` is the natural way to avoid
    // dividing by zero and appeared in the course content.
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

    // C++ precedence, applied one level at a time from the loosest. Splitting on
    // the rightmost operator of the whole expression at once, which is what this
    // did, got mixed expressions wrong: in `a < b && c < d` it split at the last
    // `<` and then tried to evaluate `300 && attempts` as a number.
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

  // A body is either a braced block or a single statement, and real student code
  // uses both. The braced form was the only one accepted, so a perfectly normal
  // `if (x) doThing();` was rejected as a missing brace.
  readBody() {
    this.skipSpace();
    if (this.source[this.index] === "{") return this.readBlock();
    return this.statement();
  }

  // Walks an `else if` chain, then an optional final `else`. Called only when
  // the condition it belongs to was false, so nothing is re-evaluated and an
  // else can never run alongside the branch that was taken.
  //
  // When the branch WAS taken the chain still has to be walked, just not run,
  // because the parser has to step over it to reach the statement after. Skipping
  // that is why `if (a) { x; } else if (b) { y; }` used to report the whole else
  // as an unsupported statement as soon as the first branch was true.
  // Walks an `else if` chain and then any final `else`, returning how the chain
  // ended so a `return` or `break` inside a branch still reaches the caller.
  //
  // `execute` is false when the chain has already been decided and only needs to
  // be stepped over. That is the part that was missing twice: a taken branch has
  // to leave the parser after the whole chain, or the trailing `else` is read as
  // a statement of its own.
  runElseChain(execute = true) {
    this.skipSpace();
    const rest = this.source.slice(this.index);
    // Matched without the opening parenthesis: readParenthesized searches for
    // the "(" from the current position onwards, so consuming it here first left
    // it looking for a second one.
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
    // A call standing alone as a statement, which is how a void function is used.
    // Handled before the declaration and assignment forms so `greet();` is a call
    // rather than an undeclared variable.
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
    // A sized array with no initialiser, filled in by later assignment. This is
    // how most C++ declares a fixed set of sensor readings, and it used to be
    // rejected, which meant a lesson could teach a construct the runner refused
    // to execute.
    const arraySizing = text.match(/^(?:const\s+)?(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string)\s+([A-Za-z_]\w*)\[(\d+)\]\s*$/);
    if (arraySizing) {
      this.arrays.set(arraySizing[1], new Array(Number(arraySizing[2])).fill(0));
      return;
    }
    // The index may be any expression, not just digits: copying into
    // kept[count] as you filter a list is ordinary C++ and was refused.
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
    // Compound assignment, before the plain assignment below. `total += 5` used
    // to fall through to the plain form, which read it as `total = (= 5)` and
    // then failed on the leftover `=`, so every accumulator written the natural
    // way was rejected.
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
    // No trailing semicolon in this pattern: executeStatement has already
    // stripped it, so requiring one here meant a bare declaration was always
    // reported as an unsupported statement.
    if (/^(?:const\s+)?(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string)\s+[A-Za-z_]\w*$/.test(text)) {
      // Declared but uninitialised, so it reads as 0 the way C++ would.
      const bare = text.match(/([A-Za-z_]\w*)$/);
      if (bare && !this.variables.has(bare[1])) this.variables.set(bare[1], 0);
      return;
    }
    throw new Error(unsupportedMessage(text));  }

  // Executes a block and reports how it ended. Both signals matter: `return`
  // unwinds the program, `break` leaves only the nearest switch case. Keeping
  // them in one return value is what stops this growing a second copy of the
  // block walker for switch support.
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
      // do { ... } while (condition); — the body always runs at least once, which
      // is the entire reason the form exists, so it is not rewritten as a while.
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
        // switch reads its own body, so it must not be consumed here first.
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
          // The chain is still walked when the branch was taken, but not run, so
          // the parser ends up after it. Skipping that is why a true branch used
          // to leave the trailing `else` to be read as a statement of its own.
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

  // switch, with C++ fall-through: a case that does not end in break or return
  // continues into the next one. That is the behaviour a beginner most often
  // trips over, so it is reproduced rather than quietly "corrected".
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
        // labelStart is where the `case 2:` text begins, which is where the
        // previous case has to stop. Cutting at the start of the label instead
        // leaves the label inside the previous chunk, where it is read as a
        // statement and the fall-through fails.
        labelStart: match.index,
        start: match.index + match[0].length,
        isDefault: match[0].startsWith("default"),
      });
      match = pattern.exec(body);
    }
    let outcome = { returned: false, broke: false };
    // C++ fall-through: once a case matches, every case after it runs too until
    // something breaks or returns. Comparing each label independently, which is
    // what this did first, skips the cases in between and is simply not C++.
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
    // Checked across the whole file rather than statement by statement, because
    // a type declared above main is never visited by the statement runner at all
    // and would otherwise be skipped in silence and reported as "no output".
    if (/\b(?:struct|class|enum|namespace|template|typedef)\b/.test(text)) {
      throw new Error(unsupportedMessage("struct"));
    }
    const functionPattern = /(?:unsigned\s+)?(?:long|short|int|double|float|bool|char|string|void)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    const mainStart = text.match(/int\s+main\s*\([^)]*\)\s*\{/);
    let mainBody = text;

    if (mainStart) {
      // Brace-match main rather than trusting the last "}" in the file. With a
      // helper defined after main, the last brace belongs to that helper, so
      // the old slicing swallowed both and the body was never run.
      mainBody = this.readBracedBlockAt(text, mainStart.index + mainStart[0].length - 1);
    }

    // Functions are collected from the whole file, not only the part before
    // main. Placing a helper after main is ordinary C++ and used to leave it
    // undefined, so calling it was reported as an unknown variable.
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
