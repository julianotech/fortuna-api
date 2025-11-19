import { relations } from "drizzle-orm";
import { categories, transactions } from "./schema";

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  // Uma transação pertence a UMA categoria
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));