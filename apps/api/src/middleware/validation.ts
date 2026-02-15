import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";

// Extend Express Request to hold validated/parsed data
declare global {
  namespace Express {
    interface Request {
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
    }
  }
}

/**
 * Express middleware factory that validates request data against a Zod schema.
 * Validates body, query, or params depending on the `source` argument.
 *
 * For "body", the parsed data replaces req.body directly.
 * For "query"/"params" (read-only in Express 5), parsed data is stored
 * on req.validatedQuery / req.validatedParams.
 */
export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: formatted,
        },
      });
      return;
    }

    // In Express 5, req.query and req.params are read-only getters
    if (source === "body") {
      req.body = result.data;
    } else if (source === "query") {
      req.validatedQuery = result.data;
    } else if (source === "params") {
      req.validatedParams = result.data;
    }

    next();
  };
}

function formatZodError(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    formatted[path || "_root"] = issue.message;
  }
  return formatted;
}
