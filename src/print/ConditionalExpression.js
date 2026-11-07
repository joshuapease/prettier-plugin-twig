import { doc } from "prettier";
import {
    EXPRESSION_NEEDED,
    STRING_NEEDS_QUOTES,
    wrapExpressionIfNeeded,
    operandNeedsParentheses
} from "../util/index.js";

const { line, indent, group } = doc.builders;

const printConditionalExpression = (node, path, print) => {
    node[EXPRESSION_NEEDED] = false;
    node[STRING_NEEDS_QUOTES] = true;

    const rest = [line, "?"];
    if (node.consequent) {
        rest.push([" ", path.call(print, "consequent")]);
    }
    if (node.alternate) {
        const printedAlternate = path.call(print, "alternate");
        // Only the fallback of `?:` can need parentheses, the branches of
        // the ternary operator extend to the end of the expression
        const alternateNeedsParentheses =
            !node.consequent &&
            operandNeedsParentheses(node, node.alternate, "right");
        rest.push(
            line,
            ": ",
            alternateNeedsParentheses
                ? ["(", printedAlternate, ")"]
                : printedAlternate
        );
    }
    const printedTest = path.call(print, "test");
    const parts = [
        operandNeedsParentheses(node, node.test, "left")
            ? ["(", printedTest, ")"]
            : printedTest,
        indent(rest)
    ];
    wrapExpressionIfNeeded(path, parts, node);

    return group(parts);
};

export { printConditionalExpression };
