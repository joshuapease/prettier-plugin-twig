import { Node } from "../melody/melody-types/index.js";
import { extension as coreExtension } from "../melody/melody-extension-core/index.js";
import { LEFT, RIGHT } from "../melody/melody-parser/index.js";

/*
 * Decides where an expression must keep its parentheses so that the printed
 * code parses back into the same tree in Twig.
 *
 * Twig parses expressions by precedence climbing: a binary operator's right
 * operand extends over every following operator that binds more tightly
 * (or equally tightly, for right-associative operators), and a prefix
 * operator's operand extends over every following operator that binds at
 * least as tightly as the prefix operator itself. Tests (`is ...`) bind like
 * a left-associative operator with precedence 100, filters like a postfix
 * operator with precedence 512, and the conditional operator (`? :`) more
 * loosely than everything else.
 *
 * Some precedences differ between Twig versions, so each operator has one
 * precedence per version below. Parentheses are kept whenever any of them
 * requires it, which makes the output mean the same thing in all of them:
 *
 * - Before Twig 3.17, the Elvis operator `?:` was parsed like the ternary
 *   operator. It is now a right-associative operator with precedence 5.
 * - Twig 3.15 and 3.21 announced new precedences for `??`, `~`, `not` and
 *   filters in Twig 4, and deprecated expressions whose meaning depends on
 *   the old ones unless they are parenthesized.
 */

const BEFORE_3_17 = 0;
const CURRENT = 1;
const TWIG_4 = 2;

const INFIX = "infix";
const PREFIX = "prefix";
const POSTFIX = "postfix";

const binaryOperators = new Map(
    coreExtension.binaryOperators.map(op => [op.text, op])
);
const unaryOperators = new Map(
    coreExtension.unaryOperators.map(op => [op.text, op])
);

const precedencesOf = op => {
    const precedences = [];
    precedences[BEFORE_3_17] = op.precedence;
    precedences[CURRENT] = op.precedence;
    precedences[TWIG_4] = op.futurePrecedence ?? op.precedence;
    return precedences;
};

const TEST = {
    kind: INFIX,
    precedences: precedencesOf(binaryOperators.get("is")),
    associativity: LEFT
};

// The ternary nests to the right: `a ? b : c ? d : e` is `a ? b : (c ? d : e)`
const TERNARY = {
    kind: INFIX,
    precedences: precedencesOf({ precedence: 0 }),
    associativity: RIGHT
};

const ELVIS = {
    kind: INFIX,
    precedences: precedencesOf({ precedence: 5 }),
    associativity: RIGHT
};
ELVIS.precedences[BEFORE_3_17] = TERNARY.precedences[BEFORE_3_17];

// Twig 4 will lower filters below unary `-` and `+`: `-a|abs` will mean
// `(-a)|abs` instead of `-(a|abs)`
const FILTER = {
    kind: POSTFIX,
    precedences: precedencesOf({ precedence: 512, futurePrecedence: 300 })
};

// `a is not null` is parsed as `not (a is null)`, but printed as a test
const isNegatedTest = node =>
    Node.isUnaryLike(node) &&
    node.operator === "not" &&
    Node.isTestExpression(node.argument);

/**
 * @returns {object|null} How the node binds when printed, or null when it
 *     binds as tightly as possible (literals, names, calls, member access,
 *     arrays, hashes, interpolated strings, ...)
 */
const getOperatorInfo = node => {
    if (!node) {
        return null;
    }
    if (Node.isConditionalExpression(node)) {
        return node.consequent ? TERNARY : ELVIS;
    }
    if (Node.isTestExpression(node) || isNegatedTest(node)) {
        return TEST;
    }
    if (Node.isFilterExpression(node)) {
        return FILTER;
    }
    if (Node.isBinaryExpression(node)) {
        // Printed as an interpolated string: "#{a} b"
        if (node.wasImplicitConcatenation) {
            return null;
        }
        const op = binaryOperators.get(node.operator);
        return op
            ? {
                  kind: INFIX,
                  precedences: precedencesOf(op),
                  associativity: op.associativity
              }
            : null;
    }
    if (Node.isUnaryLike(node)) {
        const op = unaryOperators.get(node.operator);
        // The spread operator only occurs in argument lists, arrays and hashes
        return op && node.operator !== "..."
            ? { kind: PREFIX, precedences: precedencesOf(op) }
            : null;
    }
    return null;
};

const needsParenthesesWithPrecedences = (
    child,
    parent,
    childPrecedence,
    parentPrecedence,
    side
) => {
    if (child.kind === POSTFIX) {
        return childPrecedence < parentPrecedence;
    }
    if (child.kind === PREFIX) {
        // The prefix operator's operand would swallow the parent operator
        // (or, on the right, an operator printed after this subtree that
        // binds no more loosely than the parent).
        return parent.kind === PREFIX
            ? childPrecedence < parentPrecedence
            : childPrecedence <= parentPrecedence;
    }
    if (childPrecedence !== parentPrecedence) {
        return childPrecedence < parentPrecedence;
    }
    if (parent.kind === PREFIX) {
        return false;
    }
    return side === "left"
        ? parent.associativity === RIGHT
        : parent.associativity === LEFT;
};

/**
 * Whether `child` has to be wrapped in parentheses when it is printed as an
 * operand of `parent`.
 *
 * @param {Node} parent A binary, unary, test or conditional expression
 * @param {Node} child The operand
 * @param {"left"|"right"} side Which side of the parent's operator the
 *     operand is printed on. The operand of a test and the condition of a
 *     conditional are on the left; the operand of a prefix operator and the
 *     fallback of `?:` are on the right.
 */
const operandNeedsParentheses = (parent, child, side) => {
    const childInfo = getOperatorInfo(child);
    const parentInfo = getOperatorInfo(parent);
    if (!childInfo || !parentInfo) {
        return false;
    }
    return childInfo.precedences.some((childPrecedence, version) =>
        needsParenthesesWithPrecedences(
            childInfo,
            parentInfo,
            childPrecedence,
            parentInfo.precedences[version],
            side
        )
    );
};

/**
 * Whether the node has to be wrapped in parentheses when it is the target
 * of a postfix operation such as member access (`(a ?? b).c`) or a filter.
 */
const isOperatorExpression = node => {
    const info = getOperatorInfo(node);
    return info !== null && info.kind !== POSTFIX;
};

export { operandNeedsParentheses, isOperatorExpression };
