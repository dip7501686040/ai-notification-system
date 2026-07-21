export interface AndOrCondition {
  op: "and" | "or";
  conditions: Condition[];
}

export interface NotCondition {
  op: "not";
  condition: Condition;
}

export interface FieldCondition {
  op: "equals" | "contains" | "gt" | "lt";
  field: string;
  value: unknown;
}

export interface RegexCondition {
  op: "regex";
  field: string;
  pattern: string;
}

export type Condition = AndOrCondition | NotCondition | FieldCondition | RegexCondition;

export type EvaluationContext = Record<string, unknown>;

// Pure, no DB/network -- FR-3's operator set (AND/OR/NOT/Equals/Contains/
// Regex/GreaterThan/LessThan) evaluated against a flattened context. A
// malformed condition (unknown op, wrong value types) evaluates to false
// rather than throwing, since conditions are user-authored JSON, not a
// statically-checked shape at runtime.
export function evaluate(condition: Condition, context: EvaluationContext): boolean {
  switch (condition.op) {
    case "and":
      return condition.conditions.every((child) => evaluate(child, context));
    case "or":
      return condition.conditions.some((child) => evaluate(child, context));
    case "not":
      return !evaluate(condition.condition, context);
    case "equals":
      return context[condition.field] === condition.value;
    case "contains": {
      const actual = context[condition.field];
      if (typeof actual === "string" && typeof condition.value === "string") {
        return actual.includes(condition.value);
      }
      if (Array.isArray(actual)) {
        return actual.includes(condition.value);
      }
      return false;
    }
    case "gt": {
      const actual = context[condition.field];
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual > condition.value
      );
    }
    case "lt": {
      const actual = context[condition.field];
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual < condition.value
      );
    }
    case "regex": {
      const actual = context[condition.field];
      if (typeof actual !== "string") {
        return false;
      }
      try {
        return new RegExp(condition.pattern).test(actual);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}
