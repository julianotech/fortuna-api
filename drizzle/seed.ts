import { hash } from "bcryptjs";
import { db } from "./db";
import { categories, transactions, users, usersWallets, wallets } from "./schema";

const SALT_ROUNDS = 10;



async function seed(): Promise<void> {
  console.log("🌱 Seeding database...\n");
  
  // Clean up existing data
  await db.delete(transactions);
  await db.delete(usersWallets);
  await db.delete(categories);
  await db.delete(wallets);
  await db.delete(users);

  try {
    // ============================================
    // SEED USERS
    // ============================================
    console.log("👤 Creating users...");

    const passwordParams = await hash("123456", SALT_ROUNDS);

    const usersData = [
      {
        name: "João Silva",
        email: "joao@email.com",
        password: passwordParams,
        whatsapp: "+5511999999999",
        model: "Modelo A",
        status: "active",
        role: "user"
      },
      {
        name: "Maria Oliveira",
        email: "maria@email.com",
        password: passwordParams,
        whatsapp: "+5511888888888",
        model: "Modelo B",
        status: "active",
        role: "admin" // Example admin
      },
    ];

    const createdUsers = await db.insert(users).values(usersData).returning();
    console.log(`   ✅ ${createdUsers.length} users created`);

    // ============================================
    // SEED WALLETS AND CATEGORIES
    // ============================================
    console.log("💼 Creating wallets and categories...");

    const allCategories: { id: string }[] = [];

    for (const user of createdUsers) {
      // Create Wallet
      const [wallet] = await db.insert(wallets).values({
        name: `Carteira de ${user.name.split(' ')[0]}`,
      }).returning();

      // Link User to Wallet
      await db.insert(usersWallets).values({
        userId: user.id,
        walletId: wallet.id,
        role: "owner",
      });

      // Create Categories for this user
      const userCategories = [
        {
          title: "Salário",
          type: true,
          userCreated: user.id,
          goal: "5000",
          icon: "DollarSign",
          bgColor: "bg-red-500/20",
          iconColor: "text-red-500",
        },
        {
          title: "Alimentação",
          type: false,
          userCreated: user.id,
          goal: "1000",
          icon: "ShoppingCart",
          bgColor: "bg-yellow-500/20",
          iconColor: "text-yellow-500",
        },
        {
          title: "Transporte",
          type: false,
          userCreated: user.id,
          goal: "500",
          icon: "Car",
          bgColor: "bg-blue-500/20",
          iconColor: "text-blue-500",
        },
      ];

      const createdCats = await db.insert(categories).values(userCategories).returning();
      allCategories.push(...createdCats);

      // Create Transactions
      const userTransactions = [
        {
            categoryId: createdCats[0].id, // Salário
            walletId: wallet.id,
            amount: "3000.00",
            description: "Adiantamento Salarial",
            date: new Date(),
        },
        {
            categoryId: createdCats[1].id, // Alimentação
            walletId: wallet.id,
            amount: "150.50",
            description: "Mercado Semanal",
            date: new Date(),
        }
      ];

       await db.insert(transactions).values(userTransactions);
    }

    console.log("   ✅ Wallets, Categories and Transactions created");

    // ============================================
    // SUMMARY
    // ============================================
    console.log("=".repeat(50));
    console.log("✅ Database seeded successfully!\n");
    console.log("      Email: joao@email.com / maria@email.com");
    console.log("      Password: 123456");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    throw error;
  }

  process.exit(0);
}

seed();
