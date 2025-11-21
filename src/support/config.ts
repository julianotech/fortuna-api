import { config } from "dotenv";
import { existsSync } from "fs";


export const importConfig = (): void => {
  if (existsSync(".env.local")) {
    config({ path: ".env.local", quiet: true });
  } else if (existsSync(".env")) {
    config({ path: ".env", quiet: true });
  }
}