import { doc } from "prettier";
import {
    findParentNode,
    operandNeedsParentheses,
    STRING_NEEDS_QUOTES
} from "../util/index.js";

const { softline, line, group, join, indent } = doc.builders;

const textMap = {
    TestNullExpression: "null",
    TestDivisibleByExpression: "divisible by",
    TestDefinedExpression: "defined",
    TestEmptyExpression: "empty",
    TestEvenExpression: "even",
    TestOddExpression: "odd",
    TestIterableExpression: "iterable",
    TestSameAsExpression: "same as",
    TestInstanceOfExpression: "instance of"
};

const isNegator = node =>
    node.constructor.name === "UnarySubclass" && node.operator === "not";

const printTestExpression = (node, path, print) => {
    node[STRING_NEEDS_QUOTES] = true;
    const expressionType = node.__proto__.type;
    const printedExpression = path.call(print, "expression");
    const parts = operandNeedsParentheses(node, node.expression, "left")
        ? ["(", printedExpression, ")", " is "]
        : [printedExpression, " is "];
    const parent = findParentNode(path);
    const hasArguments =
        Array.isArray(node.arguments) && node.arguments.length > 0;
    if (isNegator(parent)) {
        parts.push("not ");
    }

    if (expressionType.includes("[") && expressionType.includes("]")) {
        const testText = expressionType.substring(
            expressionType.indexOf("[") + 1,
            expressionType.lastIndexOf("]")
        );

        parts.push(testText);
    } else if (!textMap[expressionType]) {
        console.error(
            "TestExpression: No text for " + expressionType + " defined"
        );
    } else {
        parts.push(textMap[expressionType]);
    }
    if (hasArguments) {
        const printedArguments = path.map(print, "arguments");
        const joinedArguments = join([",", line], printedArguments);
        parts.push(
            group(["(", indent([softline, joinedArguments]), softline, ")"])
        );
    }

    return parts;
};

export { printTestExpression };
