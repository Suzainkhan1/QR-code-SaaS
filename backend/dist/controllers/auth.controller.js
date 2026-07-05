"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStaff = exports.getStaff = exports.addStaff = exports.me = exports.login = exports.register = void 0;
const db_1 = require("../config/db");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const enums_1 = require("../types/enums");
const JWT_SECRET = process.env.JWT_SECRET;
// Register a new Restaurant tenant & Owner User
const register = async (req, res) => {
    return res.status(403).json({ error: 'Registration is disabled for this single-café MVP system.' });
};
exports.register = register;
// Staff Login
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { email },
            include: { restaurant: true },
        });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            restaurantId: user.restaurantId,
            name: user.name,
        }, JWT_SECRET, { expiresIn: '7d' });
        // Log Activity
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Staff Login',
                details: `${user.name} (${user.role}) logged in`,
                restaurantId: user.restaurantId,
            },
        });
        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            restaurant: {
                id: user.restaurant.id,
                name: user.restaurant.name,
                slug: user.restaurant.slug,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Server error during login' });
    }
};
exports.login = login;
// Get current logged in user details
const me = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                restaurant: true,
            },
        });
        return res.json({ user });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error fetching user context' });
    }
};
exports.me = me;
// Add Staff Employee (Owner/Manager role required)
const addStaff = async (req, res) => {
    const { name, email, password, role } = req.body;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
        return res.status(401).json({ error: 'Unauthorized user context' });
    }
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    try {
        const existingUser = await db_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await db_1.prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role,
                restaurantId,
            },
        });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Employee Added',
                details: `Added new employee ${name} with role ${role}`,
                restaurantId,
            },
        });
        return res.status(201).json({
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
            },
        });
    }
    catch (error) {
        console.error('Add staff error:', error);
        return res.status(500).json({ error: 'Server error adding staff' });
    }
};
exports.addStaff = addStaff;
// Get all Staff for the Restaurant
const getStaff = async (req, res) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
        return res.status(401).json({ error: 'Unauthorized user context' });
    }
    try {
        const staff = await db_1.prisma.user.findMany({
            where: { restaurantId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ staff });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error listing staff' });
    }
};
exports.getStaff = getStaff;
// Remove Staff account
const deleteStaff = async (req, res) => {
    const { id } = req.params;
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
        return res.status(401).json({ error: 'Unauthorized user context' });
    }
    try {
        const staff = await db_1.prisma.user.findFirst({
            where: { id, restaurantId },
        });
        if (!staff) {
            return res.status(404).json({ error: 'Staff member not found' });
        }
        if (staff.role === enums_1.Role.OWNER && staff.id === req.user?.id) {
            return res.status(400).json({ error: 'Owner cannot delete their own account' });
        }
        await db_1.prisma.user.delete({ where: { id } });
        await db_1.prisma.activityLog.create({
            data: {
                action: 'Employee Deleted',
                details: `Deleted employee ${staff.name}`,
                restaurantId,
            },
        });
        return res.json({ message: 'Staff member deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Server error deleting staff' });
    }
};
exports.deleteStaff = deleteStaff;
