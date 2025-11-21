import { and, eq, ilike, or } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../../drizzle/db";
import { categories } from "../../../drizzle/schema";
import { constructCategoryQuery } from "./lib";

// Validation schema
const createCategorySchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  type: z.boolean("Tipo deve ser booleano"),
  userCreated: z.string().min(1, "Usuário criador é obrigatório"),
});

const updateCategorySchema = createCategorySchema.partial();


interface QueryCategories {
  startDate: Date,
  endDate: Date
  search: string
  type: 'income' | 'expense'
}

const getTransactionsSchema = {
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      type: { type: 'string' }
    },
  },
};

export default async function categoriesRoutes(fastify: FastifyInstance): Promise<void> {
  // List all categories
  fastify.get("/api/categories", { schema: getTransactionsSchema }, async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      const { type, search } = request.query as QueryCategories;
      const conditions = [];
      const isIncome = type === 'income'
      if (type) {
        conditions.push(
          eq(categories.type, isIncome)
        )
      }

      if (search) {
        const searchPattern = `%${search}%`;

        // Adiciona uma condição OR para buscar o texto na descrição OU no título da categoria
        conditions.push(
          or(
            ilike(categories.title, searchPattern), // <<-- Agora busca na tabela categories
          )
        );
      }

      const data = await constructCategoryQuery(db)
        .where(and(...conditions))
        .orderBy(categories.createdAt);

      return reply.send({
        success: true,
        data,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao listar categorias",
      });
    }
  });

  // Get category by ID
  fastify.get("/api/categories/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const data = await constructCategoryQuery(db)
        .where(eq(categories.id, id))
        .limit(1);

      if (!data) {
        return reply.status(404).send({
          success: false,
          message: "Categoria não encontrada",
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
        message: "Erro ao buscar categoria",
      });
    }
  });

  // Create category
  fastify.post("/api/categories", async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      request.log.info({ body: request.body }, "Received category data");
      const body = createCategorySchema.parse(request.body);
      request.log.info({ parsedBody: body }, "Parsed category data");


      const newCategories = await db.insert(categories).values(body).returning();

      return reply.status(201).send({
        success: true,
        data: newCategories[0],
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
        message: "Erro ao criar categoria",
      });
    }
  });

  // Update category
  fastify.put("/api/categories/:id", async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      const { id } = request.params as { id: string };
      const body = updateCategorySchema.parse(request.body);

      const updated = await db
        .update(categories)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({
          success: false,
          message: "Categoria não encontrada",
        });
      }

      return reply.send({
        success: true,
        data: updated[0],
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
        message: "Erro ao atualizar categoria",
      });
    }
  });

  // Delete category
  fastify.delete("/api/categories/:id", async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      const { id } = request.params as { id: string };

      const deleted = await db.delete(categories).where(eq(categories.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({
          success: false,
          message: "Categoria não encontrada",
        });
      }

      return reply.send({
        success: true,
        message: "Categoria deletada com sucesso",
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao deletar categoria",
      });
    }
  });
}
