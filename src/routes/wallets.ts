import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../drizzle/db";
import { usersWallets, wallets } from "../../drizzle/schema";

const createWalletSchema = z.object({
    name: z.string().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }),
});

export default async function walletsRoutes(fastify: FastifyInstance) {
    // List Wallets
    fastify.get("/api/wallets", async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ message: "Unauthorized" });
            }

            const userWalletsList = await db
                .select({
                    id: wallets.id,
                    name: wallets.name,
                    role: usersWallets.role,
                    createdAt: wallets.createdAt,
                })
                .from(usersWallets)
                .innerJoin(wallets, eq(usersWallets.walletId, wallets.id))
                .where(eq(usersWallets.userId, user.id));

            return reply.send({
                success: true,
                data: userWalletsList,
            });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                success: false,
                message: "Erro ao listar carteiras",
            });
        }
    });
    // Get Wallet by ID
    fastify.get("/api/wallets/:id", async (request, reply) => {
        try {
            const { id } = request.params as { id: string };

            const data = await db.select()
                .from(wallets)
                .where(eq(wallets.id, id))
                .limit(1);

            if (!data) {
                return reply.status(404).send({
                    success: false,
                    message: "Carteira não encontrada",
                });
            }

            return reply.send({
                success: true,
                data
            });
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                success: false,
                message: "Erro ao buscar carteira",
            });
        }
    });

    // Create Wallet
    fastify.post("/api/wallets", async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ message: "Unauthorized" });
            }

            const body = createWalletSchema.parse(request.body);

            const result = await db.transaction(async (tx) => {
                // 1. Create Wallet
                const [newWallet] = await tx
                    .insert(wallets)
                    .values({
                        name: body.name,
                    })
                    .returning();

                // 2. Link User to Wallet
                await tx.insert(usersWallets).values({
                    userId: user.id,
                    walletId: newWallet.id,
                    role: "owner",
                });

                return newWallet;
            });

            return reply.status(201).send({
                success: true,
                data: result,
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({
                    success: false,
                    message: "Dados inválidos",
                    errors: error.issues,
                });
            }

            request.log.error(error);
            return reply.status(500).send({
                success: false,
                message: "Erro ao criar carteira",
            });
        }
    });
}
