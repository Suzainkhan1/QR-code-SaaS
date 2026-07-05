"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestStatus = exports.StaffRequestType = exports.PaymentMethod = exports.OrderStatus = exports.TableStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["OWNER"] = "OWNER";
    Role["MANAGER"] = "MANAGER";
    Role["CASHIER"] = "CASHIER";
    Role["KITCHEN"] = "KITCHEN";
    Role["WAITER"] = "WAITER";
    Role["ADMIN"] = "ADMIN";
})(Role || (exports.Role = Role = {}));
var TableStatus;
(function (TableStatus) {
    TableStatus["AVAILABLE"] = "AVAILABLE";
    TableStatus["OCCUPIED"] = "OCCUPIED";
    TableStatus["PREPARING"] = "PREPARING";
    TableStatus["BILLING"] = "BILLING";
    TableStatus["CLEANING"] = "CLEANING";
})(TableStatus || (exports.TableStatus = TableStatus = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["ACCEPTED"] = "ACCEPTED";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["COOKING"] = "COOKING";
    OrderStatus["PACKING"] = "PACKING";
    OrderStatus["READY"] = "READY";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["UPI"] = "UPI";
    PaymentMethod["CARD"] = "CARD";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
var StaffRequestType;
(function (StaffRequestType) {
    StaffRequestType["WATER"] = "WATER";
    StaffRequestType["SPOON"] = "SPOON";
    StaffRequestType["TISSUE"] = "TISSUE";
    StaffRequestType["BILL"] = "BILL";
    StaffRequestType["CLEANING"] = "CLEANING";
    StaffRequestType["CALL_WAITER"] = "CALL_WAITER";
})(StaffRequestType || (exports.StaffRequestType = StaffRequestType = {}));
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["PENDING"] = "PENDING";
    RequestStatus["RESOLVED"] = "RESOLVED";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
