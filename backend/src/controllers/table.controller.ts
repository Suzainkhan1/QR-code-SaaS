import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { TableStatus } from '../types/enums';
import { AuthenticatedRequest } from '../middleware/auth';
import { notifyStaff } from '../socket';
import * as jwt from 'jsonwebtoken';

// PUBLIC: Verify Table by Table Number (for the single café)
export const verifyTable = async (req: Request, res: Response) => {
  const { number } = req.params;

  try {
    const restaurant = await prisma.restaurant.findFirst();

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const table = await prisma.table.findUnique({
      where: {
        restaurantId_number: {
          restaurantId: restaurant.id,
          number,
        },
      },
    });

    if (!table) {
      return res.status(404).json({ error: `Table ${number} does not exist at this restaurant` });
    }

    return res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
      table: {
        id: table.id,
        number: table.number,
        status: table.status,
        capacity: table.capacity,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error verifying table' });
  }
};

// PUBLIC: Verify Signed QR Token and Issue Customer Session JWT
export const verifyTableToken = async (req: Request, res: Response) => {
  const { number, token } = req.body;

  if (!number || !token) {
    return res.status(400).json({ error: 'Table number and QR token are required' });
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as any;

    if (decoded.number !== number || decoded.type !== 'qr') {
      return res.status(403).json({ error: 'Invalid or tampered QR code token' });
    }

    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant setup not found' });
    }

    const table = await prisma.table.findUnique({
      where: {
        restaurantId_number: {
          restaurantId: restaurant.id,
          number,
        },
      },
    });

    if (!table) {
      return res.status(404).json({ error: `Table ${number} does not exist` });
    }

    // Find or create active TableSession
    let session = await prisma.tableSession.findFirst({
      where: {
        tableId: table.id,
        isActive: true,
      },
    });

    let customerToken = '';

    if (session) {
      customerToken = session.token || '';
    }

    if (!session || !customerToken) {
      session = await prisma.tableSession.create({
        data: {
          tableId: table.id,
          restaurantId: restaurant.id,
          isActive: true,
          token: '',
        },
      });

      customerToken = jwt.sign(
        {
          role: 'CUSTOMER',
          tableId: table.id,
          tableNumber: table.number,
          restaurantId: restaurant.id,
          sessionId: session.id,
        },
        secret,
        { expiresIn: '6h' }
      );

      await prisma.tableSession.update({
        where: { id: session.id },
        data: { token: customerToken },
      });

      await prisma.table.update({
        where: { id: table.id },
        data: { status: 'OCCUPIED' },
      });

      notifyStaff(restaurant.id, 'table:update', { action: 'update', table: { ...table, status: 'OCCUPIED' } });
    }

    return res.json({
      token: customerToken,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        taxRate: restaurant.taxRate,
      },
      table: {
        id: table.id,
        number: table.number,
        status: table.status,
      },
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Table session verification error:', error);
    return res.status(403).json({ error: 'QR verification failed or code has expired' });
  }
};

// STAFF: Get all tables
export const getTables = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const tables = await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { number: 'asc' },
    });

    // Add QR code metadata URLs for printing
    const secret = process.env.JWT_SECRET!;
    const tablesWithQR = tables.map((t) => {
      const qrToken = jwt.sign({ number: t.number, type: 'qr' }, secret);
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
      const customerURL = `${frontendURL}/table/${t.number}?token=${qrToken}`;
      const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(customerURL)}`;
      return {
        ...t,
        customerURL,
        qrURL,
      };
    });

    return res.json({ tables: tablesWithQR });
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing tables' });
  }
};

// STAFF: Add new table
export const addTable = async (req: AuthenticatedRequest, res: Response) => {
  const { number, capacity } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!number) return res.status(400).json({ error: 'Table number is required' });

  try {
    const existing = await prisma.table.findUnique({
      where: {
        restaurantId_number: {
          restaurantId,
          number,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Table number already exists' });
    }

    const newTable = await prisma.table.create({
      data: {
        number,
        capacity: capacity ? parseInt(capacity) : 4,
        status: TableStatus.AVAILABLE,
        restaurantId,
      },
    });

    // Generate QR
    const customerURL = `http://localhost:5173/r/${req.user?.restaurantId}/table/${newTable.number}`;
    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(customerURL)}`;

    await prisma.activityLog.create({
      data: {
        action: 'Table Created',
        details: `Created table ${number}`,
        restaurantId,
      },
    });

    // Emit live table updates to staff
    notifyStaff(restaurantId, 'table:update', { action: 'create', table: { ...newTable, qrURL } });

    return res.status(201).json({ table: { ...newTable, qrURL } });
  } catch (error) {
    console.error('Add table error:', error);
    return res.status(500).json({ error: 'Server error adding table' });
  }
};

// STAFF: Update table status
export const updateTableStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });
  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const updated = await prisma.table.update({
      where: { id },
      data: { status: status as TableStatus },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Table Updated',
        details: `Table ${table.number} marked as ${status}`,
        restaurantId,
      },
    });

    // Emit table updates
    notifyStaff(restaurantId, 'table:update', { action: 'update', table: updated });

    return res.json({ table: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error updating table status' });
  }
};

// STAFF: Delete table
export const deleteTable = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const table = await prisma.table.findFirst({
      where: { id, restaurantId },
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    await prisma.table.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        action: 'Table Deleted',
        details: `Deleted table ${table.number}`,
        restaurantId,
      },
    });

    // Emit table updates
    notifyStaff(restaurantId, 'table:update', { action: 'delete', tableId: id });

    return res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error deleting table' });
  }
};
