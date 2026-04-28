import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient, UserRole, OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required for seed");
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  const adminPass = await hash("admin12345");
  const userPass = await hash("client12345");
  const restoPass = await hash("resto12345");

  const admin = await prisma.user.create({
    data: {
      email: "admin@seed.local",
      password: adminPass,
      name: "Admin Seed",
      role: UserRole.ADMIN
    }
  });

  const client = await prisma.user.create({
    data: {
      email: "client@seed.local",
      password: userPass,
      name: "Client Seed",
      role: UserRole.USER
    }
  });

  const restoOwner = await prisma.user.create({
    data: {
      email: "restaurant@seed.local",
      password: restoPass,
      name: "Patron Resto",
      role: UserRole.RESTAURANT
    }
  });

  const restaurantSeeds = [
    { name: "Chez Seed", city: "Paris", postalCode: "75001", address: "10 rue du Test", rating: 4.5, ownerId: restoOwner.id },
    { name: "Napoli Express", city: "Lyon", postalCode: "69002", address: "21 rue de la Republique", rating: 4.2, ownerId: admin.id },
    { name: "Tokyo Bento", city: "Marseille", postalCode: "13006", address: "8 avenue du Prado", rating: 4.6, ownerId: admin.id },
    { name: "Delhi Masala", city: "Toulouse", postalCode: "31000", address: "15 rue Alsace Lorraine", rating: 4.1, ownerId: admin.id },
    { name: "Burger Forge", city: "Bordeaux", postalCode: "33000", address: "4 cours de l'Intendance", rating: 4.0, ownerId: admin.id },
    { name: "Green Bowl", city: "Nantes", postalCode: "44000", address: "12 rue Crebillon", rating: 4.4, ownerId: admin.id },
    { name: "Le Comptoir Tacos", city: "Lille", postalCode: "59800", address: "27 rue Faidherbe", rating: 3.9, ownerId: admin.id },
    { name: "Pho Station", city: "Nice", postalCode: "06000", address: "31 avenue Jean Medecin", rating: 4.3, ownerId: admin.id },
    { name: "Pasta Fresca", city: "Rennes", postalCode: "35000", address: "6 rue Le Bastard", rating: 4.2, ownerId: admin.id },
    { name: "Sushi Peak", city: "Montpellier", postalCode: "34000", address: "19 place de la Comedie", rating: 4.7, ownerId: admin.id },
    { name: "BBQ House", city: "Strasbourg", postalCode: "67000", address: "2 rue des Grandes Arcades", rating: 4.0, ownerId: admin.id },
    { name: "Crepe Minute", city: "Brest", postalCode: "29200", address: "44 rue de Siam", rating: 3.8, ownerId: admin.id }
  ] as const;

  const dishTemplates = [
    { name: "Burger classique", description: "Steak, salade, sauce maison", price: 12.5 },
    { name: "Salade Cesar", description: "Poulet grille, parmesan, croutons", price: 9.9 },
    { name: "Pizza Margherita", description: "Tomate, mozzarella, basilic", price: 11.5 },
    { name: "Poke Saumon", description: "Riz vinaigre, saumon, avocat", price: 13.4 },
    { name: "Tacos Poulet", description: "Poulet, fromage, sauce blanche", price: 10.2 },
    { name: "Pad Thai", description: "Nouilles de riz, crevettes, cacahuetes", price: 12.9 },
    { name: "Burrito Boeuf", description: "Riz, boeuf, haricots rouges", price: 11.9 },
    { name: "Donuts Box", description: "Selection de 3 donuts", price: 7.5 }
  ] as const;

  const createdRestaurants: Array<{ id: string; name: string; dishes: Array<{ id: string; price: Prisma.Decimal }> }> = [];

  for (let idx = 0; idx < restaurantSeeds.length; idx += 1) {
    const r = restaurantSeeds[idx]!;
    const created = await prisma.restaurant.create({
      data: {
        name: r.name,
        image: null,
        address: r.address,
        postalCode: r.postalCode,
        city: r.city,
        rating: r.rating,
        ownerId: r.ownerId,
        dishes: {
          create: dishTemplates.map((tpl, dishIdx) => ({
            name: `${tpl.name} ${idx + 1}-${dishIdx + 1}`,
            description: tpl.description,
            price: tpl.price + idx * 0.15 + dishIdx * 0.1
          }))
        }
      },
      include: { dishes: { select: { id: true, price: true } } }
    });

    createdRestaurants.push({
      id: created.id,
      name: created.name,
      dishes: created.dishes
    });
  }

  for (let idx = 0; idx < createdRestaurants.length; idx += 1) {
    const restaurant = createdRestaurants[idx]!;
    const d0 = restaurant.dishes[0]!;
    const d1 = restaurant.dishes[1]!;
    const q0 = 1 + (idx % 3);
    const q1 = 1 + ((idx + 1) % 2);
    const total = Number(d0.price) * q0 + Number(d1.price) * q1;

    await prisma.order.create({
      data: {
        customerId: client.id,
        restaurantId: restaurant.id,
        status:
          idx % 4 === 0
            ? OrderStatus.PENDING
            : idx % 4 === 1
              ? OrderStatus.CONFIRMED
              : idx % 4 === 2
                ? OrderStatus.PREPARING
                : OrderStatus.READY,
        totalPrice: new Prisma.Decimal(total.toFixed(2)),
        items: {
          create: [
            { dishId: d0.id, quantity: q0, unitPrice: d0.price },
            { dishId: d1.id, quantity: q1, unitPrice: d1.price }
          ]
        }
      }
    });
  }

  console.log("Seed OK:", {
    admin: admin.email,
    client: client.email,
    restaurants: createdRestaurants.length,
    dishesPerRestaurant: dishTemplates.length,
    totalDishes: createdRestaurants.length * dishTemplates.length,
    totalOrders: createdRestaurants.length
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
