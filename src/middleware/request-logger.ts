import type { Request, Response, NextFunction } from "express";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  res.once("finish", () => {
    const duration = Date.now() - startTime;
    console.log(
      `[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
