import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../drizzle/db";
import { categories, transactions } from "../drizzle/schema";

// Validation schema
const createTransactionSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().refine((val: string): boolean => !isNaN(Date.parse(val)), {
    message: "Date must be a valid date",
  }).transform((value: string): Date => new Date(value)),
  categoryId: z.string().min(1, "Category ID is required"),
  userCreated: z.string().min(1, "User Created is required"),
  userUpdated: z.string().min(1, "User Updated is required").optional(),
});
// Define o esquema de validação dos parâmetros de query (query string)
const getTransactionsSchema = {
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' }, // Ex: '2025-10-01'
      endDate: { type: 'string', format: 'date' },   // Ex: '2025-10-31'
      search: { type: 'string' }, // Trecho de busca (description ou title)
      type: { type: 'string' }
    },
  },
};

interface QueryTransactions {
  startDate: Date,
  endDate: Date
  search: string
  type: 'income' | 'expense'
}
const updateTransactionSchema = createTransactionSchema.partial();

export default async function transactionsRoutes(fastify: FastifyInstance): Promise<void> {
  // List all transactions
  fastify.get("/api/transactions", { schema: getTransactionsSchema }, async (request, reply) => {
    try {
      // 1. Extrair e tipar os parâmetros da query
      const { startDate, endDate, search, type } = request.query as QueryTransactions;

      // 2. Construir o array de condições (WHERE clauses)
      const conditions = [];
      const isIncome = type === 'income'

      if (isIncome) {
        conditions.push(eq(categories.type, isIncome))
      }
      // Filtro de Data Inicial (startDate)
      if (startDate) {
        // Garante que a transação é MAIOR OU IGUAL (Greater Than or Equal) à data inicial
        conditions.push(gte(transactions.date, new Date(startDate)));
      }

      // Filtro de Data Final (endDate)
      if (endDate) {
        // Garante que a transação é MENOR OU IGUAL (Less Than or Equal) à data final
        conditions.push(lte(transactions.date, new Date(endDate)));
      }

      // Filtro de Busca por Texto (search)
      if (search) {
        const searchPattern = `%${search}%`; // Padrão SQL LIKE (case-insensitive search)

        // Adiciona uma condição OR para buscar o texto na descrição OU no título da categoria
        conditions.push(
          or(
            // Busca na descrição da transação
            ilike(transactions.description, searchPattern),
            ilike(categories.title, searchPattern), // <<-- Agora busca na tabela categories
          )
        );
      }

      // 3. Executar a consulta usando AND para combinar todas as condições
      const allTransactions = await db.select({
        id: transactions.id,
        categoryId: transactions.categoryId,
        amount: transactions.amount,
        description: transactions.description,
        date: transactions.date,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
      })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions)) // Aplica todas as condições combinadas com AND
        .orderBy(transactions.createdAt);

      return reply.send({
        success: true,
        data: allTransactions,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao listar transações",
      });
    }
  });

  // Get transaction by ID
  fastify.get("/api/transactions/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const transaction = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);

      if (transaction.length === 0) {
        return reply.status(404).send({
          success: false,
          message: "Transação não encontrada",
        });
      }

      return reply.send({
        success: true,
        data: transaction[0],
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao buscar transação",
      });
    }
  });

  // Create transaction
  fastify.post("/api/transactions", async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      request.log.info({ body: request.body }, "Received transaction data");
      const body = createTransactionSchema.parse(request.body);
      request.log.info({ parsedBody: body }, "Parsed category data");


      const newTransactions = await db.insert(transactions).values(body).returning();

      return reply.status(201).send({
        success: true,
        data: newTransactions[0],
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
        message: "Erro ao criar transação",
      });
    }
  });

  // Update transaction
  fastify.put("/api/transactions/:id", async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      const { id } = request.params as { id: string };
      const body = updateTransactionSchema.parse(request.body);

      const updated = await db
        .update(transactions)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(transactions.id, id))
        .returning();

      if (updated.length === 0) {
        return reply.status(404).send({
          success: false,
          message: "Transação não encontrada",
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
        message: "Erro ao atualizar transação",
      });
    }
  });

  // Delete transaction
  fastify.delete("/api/transactions/:id", async (request, reply) => {
    try {
      // TODO: Add authentication middleware
      const { id } = request.params as { id: string };

      const deleted = await db.delete(transactions).where(eq(transactions.id, id)).returning();

      if (deleted.length === 0) {
        return reply.status(404).send({
          success: false,
          message: "Transação não encontrada",
        });
      }

      return reply.send({
        success: true,
        message: "Transação deletada com sucesso",
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Erro ao deletar transação",
      });
    }
  });
}
