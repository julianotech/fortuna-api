import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import { z } from "zod";

import { db } from "../../drizzle/db";
import { categories, transactions, usersWallets, wallets } from "../../drizzle/schema";

// Validation schema
const createTransactionSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().refine((val: string): boolean => !isNaN(Date.parse(val)), {
    message: "Date must be a valid date",
  }).transform((value: string): Date => new Date(value)),
  categoryId: z.string().min(1, "Category ID is required"),
  walletId: z.string().min(1, "Wallet ID is required"),
  userCreated: z.string().min(1, "User Created is required").optional(),
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
      type: { type: 'string' },
      categoryId: { type: 'string' },
      walletId: { type: 'string' }
    },
    required: ['walletId']
  },
};

interface QueryTransactions {
  startDate: Date,
  endDate: Date
  search: string
  type: 'income' | 'expense' | 'all'
  limit: string
  categoryId: string
  walletId: string
}
const updateTransactionSchema = createTransactionSchema.partial();

export default async function transactionsRoutes(fastify: FastifyInstance): Promise<void> {
  // List all transactions
  fastify.get("/api/transactions", { schema: getTransactionsSchema }, async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      // 1. Extrair e tipar os parâmetros da query
      const { startDate, endDate, search, type, limit, categoryId, walletId } = request.query as QueryTransactions;

      // Verify wallet access
      const userWallet = await db.query.usersWallets.findFirst({
        where: and(
          eq(usersWallets.userId, user.id),
          eq(usersWallets.walletId, walletId)
        ),
      });

      if (!userWallet) {
        return reply.status(403).send({ message: "Forbidden: You do not have access to this wallet" });
      }

      // 2. Construir o array de condições (WHERE clauses)
      const conditions = [eq(transactions.walletId, walletId)]; // Scope by wallet

      if (type && type !== 'all') {
        const isIncome = type === 'income';
        conditions.push(eq(categories.type, isIncome));
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

      if (categoryId) {
        conditions.push(eq(transactions.categoryId, categoryId));
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
      const categoryType = sql`
            CASE 
                WHEN ${categories.type} THEN 'income' 
                ELSE 'expense' 
            END
        `.as("categoryType");

      // 3. Executar a consulta usando AND para combinar todas as condições
      const baseQuery = db.select({
        id: transactions.id,
        categoryId: transactions.categoryId,
        amount: transactions.amount,
        description: transactions.description,
        date: transactions.date,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        type: categoryType,
        icon: sql<string>`COALESCE(${categories.icon}, 'BadgeDollarSign')`.as('icon')
      })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions)!) // Aplica todas as condições combinadas com AND

      let dataQuery = baseQuery
        .orderBy(transactions.createdAt)
        .$dynamic();

      if (limit) {
        const limitValue = parseInt(limit, 10);
        if (!isNaN(limitValue) && limitValue > 0) {
          dataQuery = dataQuery.limit(limitValue);
        }
      }

      // --- QUERY DE CONTAGEM (APENAS COUNT) ---
      // Reutiliza as cláusulas FROM, JOIN e WHERE, mas seleciona apenas o COUNT.
      const countQuery = db.select({
        total: sql<number>`count(*)`
      })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions)!); // Force non-null assertion as we know conditions is not empty

      // 4. Executar as duas queries em paralelo
      const [allTransactions, totalCountResult] = await Promise.all([
        dataQuery,
        countQuery,
      ]);

      const totalRows = totalCountResult[0].total;

      // 5. Retorna os dados e o total
      return reply.send({
        success: true,
        data: allTransactions,
        total: totalRows,
        hasMore: totalRows > allTransactions.length
      });
    }
    catch (error) {
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

  // Get transaction by ID
  fastify.get("/api/transactions/:id", async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      // Join with wallets to check access
      const transaction = await db
        .select({
          transaction: transactions,
        })
        .from(transactions)
        .innerJoin(wallets, eq(transactions.walletId, wallets.id))
        .innerJoin(usersWallets, eq(wallets.id, usersWallets.walletId))
        .where(and(
          eq(transactions.id, id),
          eq(usersWallets.userId, user.id)
        ))
        .limit(1);

      if (transaction.length === 0) {
        return reply.status(404).send({
          success: false,
          message: "Transação não encontrada ou acesso negado",
        });
      }

      return reply.send({
        success: true,
        data: transaction[0].transaction,
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
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      request.log.info({ body: request.body }, "Received transaction data");
      const body = createTransactionSchema.parse(request.body);
      request.log.info({ parsedBody: body }, "Parsed transaction data");

      // Verify wallet access
      const userWallet = await db.query.usersWallets.findFirst({
        where: and(
          eq(usersWallets.userId, user.id),
          eq(usersWallets.walletId, body.walletId)
        ),
      });

      if (!userWallet) {
        return reply.status(403).send({ message: "Forbidden: You do not have access to this wallet" });
      }

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
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params as { id: string };
      const body = updateTransactionSchema.parse(request.body);

      // Verify access to the transaction (via wallet)
      const existingTransaction = await db
        .select({ walletId: transactions.walletId })
        .from(transactions)
        .where(eq(transactions.id, id))
        .limit(1);

      if (existingTransaction.length === 0) {
        return reply.status(404).send({ message: "Transação não encontrada" });
      }

      // Check if user has access to the wallet of the transaction
      const userWallet = await db.query.usersWallets.findFirst({
        where: and(
          eq(usersWallets.userId, user.id),
          eq(usersWallets.walletId, existingTransaction[0].walletId!)
        ),
      });

      if (!userWallet) {
        return reply.status(403).send({ message: "Forbidden: You do not have access to this transaction" });
      }

      // If changing wallet, verify access to new wallet
      if (body.walletId && body.walletId !== existingTransaction[0].walletId) {
        const newUserWallet = await db.query.usersWallets.findFirst({
          where: and(
            eq(usersWallets.userId, user.id),
            eq(usersWallets.walletId, body.walletId)
          ),
        });
        if (!newUserWallet) {
          return reply.status(403).send({ message: "Forbidden: You do not have access to the target wallet" });
        }
      }

      const updated = await db
        .update(transactions)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(transactions.id, id))
        .returning();

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
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const { id } = request.params as { id: string };

      // Verify access
      const existingTransaction = await db
        .select({ walletId: transactions.walletId })
        .from(transactions)
        .where(eq(transactions.id, id))
        .limit(1);

      if (existingTransaction.length === 0) {
        return reply.status(404).send({ message: "Transação não encontrada" });
      }

      const userWallet = await db.query.usersWallets.findFirst({
        where: and(
          eq(usersWallets.userId, user.id),
          eq(usersWallets.walletId, existingTransaction[0].walletId!)
        ),
      });

      if (!userWallet) {
        return reply.status(403).send({ message: "Forbidden: You do not have access to this transaction" });
      }

      await db.delete(transactions).where(eq(transactions.id, id)).returning();

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
