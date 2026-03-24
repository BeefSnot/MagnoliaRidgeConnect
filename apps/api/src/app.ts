import "express-async-errors";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import { router } from "./modules/index.js";

export const app = express();

const noopIo = {
  emit: (_event: string, _payload?: unknown) => {},
  to: (_room: string) => ({
    emit: (_event: string, _payload?: unknown) => {}
  })
};

app.set("io", noopIo);

const configuredOrigins = env.CLIENT_ORIGIN
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006"
];

const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: "MRC API", dataMode: env.DATA_MODE });
});

app.use("/api", router);
app.use(errorHandler);
