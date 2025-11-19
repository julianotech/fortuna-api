import { eq, sql } from "drizzle-orm";
import type { DB } from "drizzle/db";
import { categories, transactions } from "drizzle/schema";

export function constructCategoryQuery(db: DB) {
  const totalSpent = sql`
    COALESCE(
        SUM(CAST(REPLACE(${transactions.amount}::TEXT, ',', '.') AS NUMERIC)),
        0
    )
`.as("totalSpent");
  const selectCategory = {
    id: categories.id,
    title: categories.title,
    icon: categories.icon,
    iconColor: categories.iconColor,
    bgColor: categories.bgColor,
    type: categories.type,
    goal: categories.goal,
    spent: totalSpent,
    createdAt: categories.createdAt,
    updatedAt: categories.updatedAt,
  }
  return db.select(selectCategory)
    .from(categories)
    .leftJoin(transactions, eq(categories.id, transactions.categoryId))
    .groupBy(
      categories.id,
      categories.title,
      categories.type,
      categories.goal,
      categories.createdAt,
      categories.updatedAt
    )
}