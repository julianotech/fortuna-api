import { compare, hash } from "bcrypt";
import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { z } from "zod";

import { db } from "../../drizzle/db";
import { adminUsers } from "../../drizzle/schema";
import { env } from "../support";

const JWT_EXPIRES_IN = "7d";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

const createUserSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
  name: z.string().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }),
  role: z.enum(["admin", "super_admin"]).optional().default("admin"),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post("/api/auth/login", async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);

      // Find user by email
      const users = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, body.email))
        .limit(1);

      const user = users[0];

      if (!user) {
        return reply.status(401).send({
          success: false,
          message: "Credenciais inválidas",
        });
      }

      // Check if user is active
      if (user.isActive !== 1) {
        return reply.status(403).send({
          success: false,
          message: "Usuário inativo. Entre em contato com o administrador.",
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

      // Update last login
      await db
        .update(adminUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminUsers.id, user.id));

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Return user data (without password) and token
      const { password: _, ...userWithoutPassword } = user;

      return reply.send({
        success: true,
        data: {
          user: userWithoutPassword,
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

  // Get current user (verify token)
  fastify.get("/api/auth/me", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).send({
          success: false,
          message: "Token não fornecido",
        });
      }

      const token = authHeader.substring(7);

      // Verify token
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id: string;
        email: string;
        role: string;
      };

      // Get user from database
      const users = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, decoded.id))
        .limit(1);

      const user = users[0];

      if (!user || user.isActive !== 1) {
        return reply.status(401).send({
          success: false,
          message: "Usuário não encontrado ou inativo",
        });
      }

      const { password: _, ...userWithoutPassword } = user;

      return reply.send({
        success: true,
        data: userWithoutPassword,
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return reply.status(401).send({
          success: false,
          message: "Token inválido",
        });
      }

      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao verificar token",
      });
    }
  });

  // Create new admin user (protected - only super_admin)
  fastify.post("/api/auth/users", async (request, reply) => {
    try {
      // TODO: Add middleware to verify super_admin role
      const body = createUserSchema.parse(request.body);

      // Check if user already exists
      const existingUsers = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, body.email))
        .limit(1);

      if (existingUsers.length > 0) {
        return reply.status(409).send({
          success: false,
          message: "Email já cadastrado",
        });
      }

      // Hash password
      const hashedPassword = await hash(body.password, 10);

      // Create user
      const newUsers = await db
        .insert(adminUsers)
        .values({
          email: body.email,
          password: hashedPassword,
          name: body.name,
          role: body.role,
          isActive: 1,
        })
        .returning();

      const newUser = newUsers[0];
      const { password: _, ...userWithoutPassword } = newUser;

      return reply.status(201).send({
        success: true,
        data: userWithoutPassword,
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
        message: "Erro ao criar usuário",
      });
    }
  });

  // List all admin users (protected)
  fastify.get("/api/auth/users", async (request, reply) => {
    try {
      // TODO: Add authentication middleware

      const users = await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          name: adminUsers.name,
          role: adminUsers.role,
          isActive: adminUsers.isActive,
          lastLoginAt: adminUsers.lastLoginAt,
          createdAt: adminUsers.createdAt,
        })
        .from(adminUsers)
        .orderBy(adminUsers.createdAt);

      return reply.send({
        success: true,
        data: users,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao listar usuários",
      });
    }
  });
}
