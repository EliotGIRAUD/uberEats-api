/** Schéma GraphQL restaurant / plats / commandes (TP 8). */
export const restaurantSchema = `
  enum OrderStatus {
    PENDING
    CONFIRMED
    PREPARING
    READY
    DELIVERED
    CANCELLED
  }

  type User {
    id: ID!
    email: String!
    role: String!
  }

  type PaginationMeta {
    total: Int!
    limit: Int!
    offset: Int!
  }

  type PaginatedRestaurants {
    data: [Restaurant!]!
    pagination: PaginationMeta!
  }

  type PaginatedDishes {
    data: [Dish!]!
    pagination: PaginationMeta!
  }

  type PaginatedOrders {
    data: [Order!]!
    pagination: PaginationMeta!
  }

  type Restaurant {
    id: ID!
    name: String!
    image: String
    address: String
    postalCode: String
    city: String
    rating: Float
    ownerId: ID!
    createdAt: String!
    updatedAt: String!
    dishes: [Dish!]!
    orders: [Order!]!
  }

  type Dish {
    id: ID!
    name: String!
    description: String
    price: Float!
    image: String
    restaurantId: ID!
    createdAt: String!
    updatedAt: String!
  }

  type Order {
    id: ID!
    status: OrderStatus!
    totalPrice: Float!
    customerId: ID!
    restaurantId: ID!
    createdAt: String!
    updatedAt: String!
    items: [OrderItem!]!
  }

  type OrderItem {
    id: ID!
    orderId: ID!
    dishId: ID!
    quantity: Int!
    unitPrice: Float!
    createdAt: String!
    updatedAt: String!
    dish: Dish!
  }

  type Query {
    restaurants(limit: Int, offset: Int, name: String, city: String, rating: Float): PaginatedRestaurants!
    restaurant(id: ID!): Restaurant
    dishes(
      restaurantId: ID!
      limit: Int
      offset: Int
      nameContains: String
      minPrice: Float
      maxPrice: Float
    ): PaginatedDishes!
    orders(limit: Int, offset: Int, status: OrderStatus, restaurantId: ID): PaginatedOrders!
    me: User
  }

  input CreateRestaurantInput {
    name: String!
    image: String
    address: String
    postalCode: String
    city: String
    rating: Float
  }

  input UpdateRestaurantInput {
    name: String
    image: String
    address: String
    postalCode: String
    city: String
    rating: Float
  }

  input CreateDishInput {
    name: String!
    description: String
    price: Float!
    image: String
  }

  input UpdateDishInput {
    name: String
    description: String
    price: Float
    image: String
  }

  input CreateOrderItemInput {
    dishId: ID!
    quantity: Int!
  }

  input CreateOrderInput {
    restaurantId: ID!
    items: [CreateOrderItemInput!]!
  }

  type Mutation {
    createMyRestaurant(input: CreateRestaurantInput!): Restaurant!
    updateMyRestaurant(input: UpdateRestaurantInput!): Restaurant!
    createDish(restaurantId: ID!, input: CreateDishInput!): Dish!
    updateDish(dishId: ID!, input: UpdateDishInput!): Dish!
    deleteDish(dishId: ID!): Boolean!
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
    cancelOrder(orderId: ID!): Boolean!
  }
`;
