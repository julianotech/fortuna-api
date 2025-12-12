import { boolean, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// Categories Table
export const categories = pgTable("categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  title: text("title").notNull(),
  type: boolean("type").notNull().default(true), // true = income, false = expense
  goal: text("goal"),
  icon: text("icon"),
  iconColor: text("icon_color"),
  bgColor: text("bg_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  userCreated: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// Users Table (shared with portal-sheet-view)
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // Hashed
  whatsapp: text("whatsapp").unique(), // Made optional as email is now primary for auth
  model: text("model"),
  status: text("status").notNull().default("active"),
  role: text("role").notNull().default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Wallets Table
export const wallets = pgTable("wallets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users-Wallets Many-to-Many Table
export const usersWallets = pgTable("users_wallets", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  walletId: text("wallet_id")
    .notNull()
    .references(() => wallets.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("owner"), // owner, member, viewer
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.walletId] }),
}));

// Products Table (shared with portal-sheet-view)
export const transactions = pgTable("transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  categoryId: text("category_id").notNull(),
  walletId: text("wallet_id")
    .references(() => wallets.id, { onDelete: "cascade" }), // Made nullable for migration/backward compatibility if needed, but ideally should be notNull
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type inference
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transactions = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;



export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type UsersWallets = typeof usersWallets.$inferSelect;
export type NewUsersWallets = typeof usersWallets.$inferInsert;
