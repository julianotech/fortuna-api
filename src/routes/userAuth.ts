import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { db } from "../../drizzle/db";
import { users, usersWallets, wallets } from "../../drizzle/schema";
import { env } from "../support";

const JWT_EXPIRES_IN = "7d";

// Validation schemas
const registerSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
    name: z.string().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }),
    whatsapp: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

export default async function userAuthRoutes(fastify: FastifyInstance) {
    // Register User
    fastify.post("/api/auth/register", async (request, reply) => {
        try {
            const body = registerSchema.parse(request.body);

            // Check if user already exists
            const existingUser = await db.query.users.findFirst({
                where: eq(users.email, body.email),
            });

            if (existingUser) {
                return reply.status(409).send({
                    success: false,
                    message: "Email já cadastrado",
                });
            }

            // Hash password
            const hashedPassword = await hash(body.password, 10);

            // Transaction to create user, wallet, and link them
            const result = await db.transaction(async (tx) => {
                // 1. Create User
                const [newUser] = await tx
                    .insert(users)
                    .values({
                        email: body.email,
                        password: hashedPassword,
                        name: body.name,
                        whatsapp: body.whatsapp,
                    })
                    .returning();

                // 2. Create Default Wallet
                const [newWallet] = await tx
                    .insert(wallets)
                    .values({
                        name: "Carteira Principal",
                    })
                    .returning();

                // 3. Link User to Wallet
                await tx.insert(usersWallets).values({
                    userId: newUser.id,
                    walletId: newWallet.id,
                    role: "owner",
                });

                return { user: newUser, wallet: newWallet };
            });

            // Generate Token
            const token = jwt.sign(
                { id: result.user.id, email: result.user.email },
                env.JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            const { password: _, ...userWithoutPassword } = result.user;

            return reply.status(201).send({
                success: true,
                data: {
                    user: userWithoutPassword,
                    wallet: result.wallet,
                    token,
                },
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
                message: "Erro ao registrar usuário",
            });
        }
    });

    // Login User
    fastify.post("/api/auth/login", async (request, reply) => {
        try {
            const body = loginSchema.parse(request.body);

            // Find user
            const user = await db.query.users.findFirst({
                where: eq(users.email, body.email),
            });

            if (!user) {
                return reply.status(401).send({
                    success: false,
                    message: "Credenciais inválidas",
                });
            }

            if (user.status !== 'active') {
                return reply.status(403).send({
                    success: false,
                    message: "Usuário inativo",
                });
            }

            // Verify password
            const isPasswordValid = await compare(body.password, user.password);

            if (!isPasswordValid) {
                return reply.status(401).send({
                    success: false,
                    message: "Credenciais inválidas",
                });
            }

            // Generate Token
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                env.JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // Fetch user wallets
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

            const { password: _, ...userWithoutPassword } = user;

            return reply.send({
                success: true,
                data: {
                    user: userWithoutPassword,
                    wallets: userWalletsList,
                    token,
                },
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
                message: "Erro ao fazer login",
            });
        }
    });

    // Get Current User
    fastify.get("/api/auth/me", async (request, reply) => {
        try {
            // request.user is populated by authMiddleware
            const userId = request.user?.id;

            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    message: "Não autenticado",
                });
            }

            const user = await db.query.users.findFirst({
                where: eq(users.id, userId),
            });

            if (!user) {
                return reply.status(404).send({
                    success: false,
                    message: "Usuário não encontrado",
                });
            }

            // Fetch user wallets
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


            const { password: _, ...userWithoutPassword } = user;

            return reply.send({
                success: true,
                data: {
                    user: userWithoutPassword,
                    wallets: userWalletsList
                },
            });

        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                success: false,
                message: "Erro ao buscar dados do usuário",
            });
        }
    });
}
