import { hash } from "bcrypt";

import { db } from "./db";
import { adminUsers, categories, transactions, users } from "./schema";

const SALT_ROUNDS = 10;

function getRandomId(arr: string[]): string {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}
async function seed(): Promise<void> {
  console.log("🌱 Seeding database...\n");
  await db.delete(users)
  await db.delete(categories)
  await db.delete(adminUsers)

  try {
    // ============================================
    // SEED ADMIN USERS (from portal-admin)
    // ============================================
    console.log("👤 Creating admin users...");

    const hashedPassword = await hash("admin123", SALT_ROUNDS);

    await db
      .insert(adminUsers)
      .values([
        {
          email: "admin@portal.com",
          password: hashedPassword,
          name: "Administrador",
          role: "super_admin",
          isActive: 1,
        },
      ])
      .onConflictDoNothing();

    const userIds = await seedsUsers()

    console.log("   ✅ Admin user created:");
    console.log("      Email: admin@portal.com");
    console.log("      Password: admin123");
    console.log("      Role: super_admin\n");

    console.log("📦 Creating categories...");



    const seedCategories = [
      {
        title: "Salário",
        type: true,
        userCreated: getRandomId(userIds)
      },
      {
        title: "Freelance",
        type: true,
        userCreated: getRandomId(userIds)
      },
      {
        title: "Aluguel",
        type: false,
        userCreated: getRandomId(userIds)
      },
      {
        title: "Supermercado",
        type: false,
        userCreated: getRandomId(userIds)
      },
      {
        title: "Transporte",
        type: false,
        userCreated: getRandomId(userIds)
      },
    ]

    await db.insert(categories).values(seedCategories).onConflictDoNothing();

    console.log(`   ✅ ${seedCategories.length} categories created\n`);

    const avaliableCategories = await db.select({
      id: categories.id
    }).from(categories).then((rows: { id: string }[]): string[] => rows.map(row => row.id));

    console.log("📦 Creating transactions...");
    const seedTransactions = [
      {
        categoryId: getRandomId(avaliableCategories),
        amount: "5000",
        description: "Salário mensal",
        date: new Date("2024-06-01"),
        userCreated: getRandomId(userIds)
      },
      {
        categoryId: getRandomId(avaliableCategories),
        amount: "200",
        description: "Freelance projeto X",
        date: new Date("2024-06-10"),
        userCreated: getRandomId(userIds)
      },
      {
        categoryId: getRandomId(avaliableCategories),
        amount: "1200",
        description: "Aluguel do mês",
        date: new Date("2024-06-05"),
        userCreated: getRandomId(userIds)
      },
      {
        categoryId: getRandomId(avaliableCategories),
        amount: "300",
        description: "Compras no supermercado",
        date: new Date("2024-06-08"),
        userCreated: getRandomId(userIds)
      },
      {
        categoryId: getRandomId(avaliableCategories),
        amount: "100",
        description: "Transporte público",
        date: new Date("2024-06-03"),
        userCreated: getRandomId(userIds)
      },
    ];


    await db.insert(transactions).values(seedTransactions).onConflictDoNothing();
    console.log(`   ✅ ${seedTransactions.length} transactions created\n`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log("=".repeat(50));
    console.log("✅ Database seeded successfully!\n");
    console.log("⚠️  IMPORTANTE: Altere a senha do admin após o primeiro login!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    throw error;
  }

  process.exit(0);
}
// Importe o uuidv7 ou use a função nativa do Drizzle se necessário.


async function seedsUsers(): Promise<string[]> {
  const now = new Date();



  console.log("Iniciando a inserção de campanhas...");

  await db
    .insert(users)
    .values([
      {
        name: "João Silva",
        whatsapp: "+5511999999999",
        model: "Modelo A",
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Maria Oliveira",
        whatsapp: "+5511888888888",
        model: "Modelo B",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .onConflictDoNothing(); // Evita erro se a inserção for rodada múltiplas vezes (baseado no seu exemplo)

  console.log("Inserção de campanhas concluída.");
  return await db.select({
    id: users.id
  }).from(users).then((rows: { id: string }[]): string[] => rows.map(row => row.id));
}

seed();
