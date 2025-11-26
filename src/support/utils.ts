import { env } from "process"
import { importConfig } from "./config"
importConfig()

export const isProduction = env.NODE_ENV === 'production'