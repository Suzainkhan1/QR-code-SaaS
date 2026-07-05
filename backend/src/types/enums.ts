export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  KITCHEN = 'KITCHEN',
  WAITER = 'WAITER',
  ADMIN = 'ADMIN',
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  PREPARING = 'PREPARING',
  BILLING = 'BILLING',
  CLEANING = 'CLEANING',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  PREPARING = 'PREPARING',
  COOKING = 'COOKING',
  PACKING = 'PACKING',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
}

export enum StaffRequestType {
  WATER = 'WATER',
  SPOON = 'SPOON',
  TISSUE = 'TISSUE',
  BILL = 'BILL',
  CLEANING = 'CLEANING',
  CALL_WAITER = 'CALL_WAITER',
}

export enum RequestStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
}
