import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

export const prisma = env.DATA_MODE === "mysql"
	? new PrismaClient()
	: (null as unknown as PrismaClient);
