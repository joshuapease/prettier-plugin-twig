import { Node } from "../melody/melody-types/index.js";
import { extension as coreExtension } from "../melody/melody-extension-core/index.js";
import { isValidIdentifierName, STRING_NEEDS_QUOTES } from "../util/index.js";

// The lexer reads these as constants even when more letters follow them
// (`nullable` is lexed as `null` followed by `able`), so a key that starts
// with one of them can't be written without quotes.
const CONSTANT_PREFIX = /^(true|false|null|none)/i;

// Operators made only of letters (`and`, `in`, `not`, ...). Without quotes,
// the lexer reads these as operators rather than as a key.
const WORD_OPERATORS = new Set(
    [...coreExtension.unaryOperators, ...coreExtension.binaryOperators]
        .map(op => op.text.toLowerCase())
        .filter(text => /^[a-z]+$/.test(text))
);

const canPrintKeyWithoutQuotes = name =>
    isValidIdentifierName(name) &&
    !CONSTANT_PREFIX.test(name) &&
    !WORD_OPERATORS.has(name.toLowerCase());

const printObjectProperty = (node, path, print, options) => {
    // A computed key is an expression, so a string literal inside the
    // parentheses must keep its quotes: `('foo-bar')` is a string, while
    // `(foo-bar)` is a subtraction.
    node[STRING_NEEDS_QUOTES] =
        node.computed ||
        (Node.isStringLiteral(node.key) &&
            !canPrintKeyWithoutQuotes(node.key.value));
    const shouldPrintKeyAsString = node.key?.wasImplicitConcatenation;
    const needsParentheses = node.computed && !shouldPrintKeyAsString;
    const parts = [];

    // print "key" part if they exist
    if (node.key !== null) {
        if (needsParentheses) {
            parts.push("(");
        }
        parts.push(path.call(print, "key"));
        if (needsParentheses) {
            parts.push(")");
        }
        parts.push(": ");
    }

    // print "value" part
    node[STRING_NEEDS_QUOTES] = true;
    parts.push(path.call(print, "value"));
    return parts;
};

export { printObjectProperty };
