declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BOT_TOKEN: string;
      PUBLIC_KEY: string;
      CLIENT_ID: string;
      CLIENT_SECRET: string;
    }
  }
}

export {};
