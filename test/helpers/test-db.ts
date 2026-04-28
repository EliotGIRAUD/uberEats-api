import { prisma } from "../../src/lib/prisma.js";

export async function connectTestDb() {
  await prisma.$connect();
}

export async function resetTestDb() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectTestDb() {
  await prisma.$disconnect();
}
