import { Response } from 'express';
import { prisma } from '../config/db';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Role, TableStatus } from '../types/enums';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'crunchos_jwt_secret_key_2026_super_secure';

// Register a new Restaurant tenant & Owner User
export const register = async (req: AuthenticatedRequest, res: Response) => {
  return res.status(403).json({ error: 'Registration is disabled for this single-café MVP system.' });
};

// Staff Login
export const login = async (req: AuthenticatedRequest, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
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

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Log Activity
    await prisma.activityLog.create({
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
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

// Get current logged in user details
export const me = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await prisma.user.findUnique({
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
  } catch (error) {
    return res.status(500).json({ error: 'Server error fetching user context' });
  }
};

// Add Staff Employee (Owner/Manager role required)
export const addStaff = async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, password, role } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    return res.status(401).json({ error: 'Unauthorized user context' });
  }

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as Role,
        restaurantId,
      },
    });

    await prisma.activityLog.create({
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
  } catch (error) {
    console.error('Add staff error:', error);
    return res.status(500).json({ error: 'Server error adding staff' });
  }
};

// Get all Staff for the Restaurant
export const getStaff = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) {
    return res.status(401).json({ error: 'Unauthorized user context' });
  }

  try {
    const staff = await prisma.user.findMany({
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
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing staff' });
  }
};

// Remove Staff account
export const deleteStaff = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) {
    return res.status(401).json({ error: 'Unauthorized user context' });
  }

  try {
    const staff = await prisma.user.findFirst({
      where: { id, restaurantId },
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (staff.role === Role.OWNER && staff.id === req.user?.id) {
      return res.status(400).json({ error: 'Owner cannot delete their own account' });
    }

    await prisma.user.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        action: 'Employee Deleted',
        details: `Deleted employee ${staff.name}`,
        restaurantId,
      },
    });

    return res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error deleting staff' });
  }
};
