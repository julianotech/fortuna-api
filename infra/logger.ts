export const loggerOptions = {
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "SYS:HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
        levelFirst: true,
        messageFormat: "{levelLabel} - {msg}",
        customLevels: "trace:10,debug:20,info:30,warn:40,error:50,fatal:60",
        customColors: "trace:gray,debug:blue,info:green,warn:yellow,error:red,fatal:bgRed",
      },
    },
  },
}