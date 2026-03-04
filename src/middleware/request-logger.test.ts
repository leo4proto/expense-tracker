import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { EventEmitter } from "node:events";
import type { Request, Response, NextFunction } from "express";
import { requestLogger } from "./request-logger.js";

type MockResponse = Response & EventEmitter;

function makeRes(statusCode: number): MockResponse {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { statusCode }) as MockResponse;
}

describe("requestLogger", () => {
  let consoleSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("calls next() to pass control to the next middleware", () => {
    const req = { method: "GET", originalUrl: "/health" } as Request;
    const res = makeRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not log before the response finishes", () => {
    const req = { method: "POST", originalUrl: "/webhook/whatsapp" } as Request;
    const res = makeRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("logs the correct format for a POST 200 response", () => {
    const req = { method: "POST", originalUrl: "/webhook/whatsapp" } as Request;
    const res = makeRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit("finish");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const message = consoleSpy.mock.calls[0][0] as string;
    expect(message).toMatch(
      /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] POST \/webhook\/whatsapp 200 \d+ms$/
    );
  });

  it("logs the correct format for a GET 404 response", () => {
    const req = { method: "GET", originalUrl: "/not-found" } as Request;
    const res = makeRes(404);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit("finish");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const message = consoleSpy.mock.calls[0][0] as string;
    expect(message).toMatch(
      /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] GET \/not-found 404 \d+ms$/
    );
  });

  it("includes a non-negative response time in ms", () => {
    const req = { method: "GET", originalUrl: "/health" } as Request;
    const res = makeRes(200);
    const next = jest.fn() as unknown as NextFunction;

    requestLogger(req, res, next);
    res.emit("finish");

    const message = consoleSpy.mock.calls[0][0] as string;
    const match = message.match(/(\d+)ms$/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(0);
  });
});
