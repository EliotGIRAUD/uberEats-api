import WebSocket from "ws";

/** Connexions ouvertes par restaurant (plusieurs onglets / appareils possibles). */
const restaurantConnections = new Map<string, Set<WebSocket>>();

export function registerRestaurantConnection(restaurantId: string, socket: WebSocket): void {
  let set = restaurantConnections.get(restaurantId);
  if (!set) {
    set = new Set();
    restaurantConnections.set(restaurantId, set);
  }
  set.add(socket);
}

export function unregisterRestaurantConnection(restaurantId: string, socket: WebSocket): void {
  const set = restaurantConnections.get(restaurantId);
  if (!set) {
    return;
  }
  set.delete(socket);
  if (set.size === 0) {
    restaurantConnections.delete(restaurantId);
  }
}

export type NewOrderNotificationData = {
  orderId: string;
  totalPrice: number;
  itemCount: number;
  createdAt: string;
};

/** Envoie un message JSON à tous les clients WebSocket du restaurant. */
export function notifyRestaurant(restaurantId: string, event: string, data: NewOrderNotificationData): void {
  const set = restaurantConnections.get(restaurantId);
  if (!set || set.size === 0) {
    return;
  }

  const payload = JSON.stringify({
    event,
    data,
    timestamp: Date.now()
  });

  for (const socket of set) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
