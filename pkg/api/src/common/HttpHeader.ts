import express from "express";

export enum HttpHeader {
  UserId = "Api-User-ID"
}

export function getUserIdHeader(req: express.Request) {
  return req.get(HttpHeader.UserId) as string;
}
