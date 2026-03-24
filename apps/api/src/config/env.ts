import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:8081"),
  DATA_MODE: z.enum(["memory", "database", "mysql"]).default("memory"),
  AUTO_APPROVE_REGISTRATION: z.coerce.boolean().default(false),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional()
}).superRefine((value, ctx) => {
  const usingDatabase = value.DATA_MODE !== "memory";

  if (usingDatabase && !value.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required when DATA_MODE=database"
    });
  }

  if (usingDatabase && (!value.JWT_SECRET || value.JWT_SECRET.length < 24)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET (min 24 chars) is required when DATA_MODE=database"
    });
  }
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  DATA_MODE: parsed.DATA_MODE === "mysql" ? "database" : parsed.DATA_MODE,
  JWT_SECRET: parsed.JWT_SECRET && parsed.JWT_SECRET.length >= 24
    ? parsed.JWT_SECRET
    : "mrc-memory-dev-secret-change-before-mysql"
};
