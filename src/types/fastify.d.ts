import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      wallets: Array<{
        id: string;
        name: string;
        role: string;
      }>;
    };
  }
}

