import { doc } from "prettier";
import {
    EXPRESSION_NEEDED,
    STRING_NEEDS_QUOTES,
    wrapExpressionIfNeeded,
    isOperatorExpression
} from "../util/index.js";

const { group } = doc.builders;

const printMemberExpression = (node, path, print) => {
    node[EXPRESSION_NEEDED] = false;
    node[STRING_NEEDS_QUOTES] = true;
    const printedObject = path.call(print, "object");
    const parts = isOperatorExpression(node.object)
        ? ["(", printedObject, ")"]
        : [printedObject];
    parts.push(node.computed ? "[" : ".");
    parts.push(path.call(print, "property"));
    if (node.computed) {
        parts.push("]");
    }
    wrapExpressionIfNeeded(path, parts, node);
    return group(parts);
};

export { printMemberExpression };
