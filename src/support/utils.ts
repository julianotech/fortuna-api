import { importConfig } from "./config"
importConfig()

export const isProduction = process.env.NODE_ENV !== 'production'