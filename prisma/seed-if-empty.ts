import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

async function main() {
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log("Database is empty, running seed...");
    execSync("npm run db:seed", { stdio: "inherit" });
    return;
  }

  console.log("Database already contains users, skipping seed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    void prisma.$disconnect();
    process.exit(1);
  });
