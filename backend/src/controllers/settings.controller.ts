import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getSettings = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    return res.json({ settings: restaurant });
  } catch (error) {
    return res.status(500).json({ error: 'Server error fetching settings' });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, email, address, taxRate, serviceCharge, logo } = req.body;
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name,
        phone,
        email,
        address,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : undefined,
        serviceCharge: serviceCharge !== undefined ? parseFloat(serviceCharge) : undefined,
        logo,
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'Settings Updated',
        details: 'Restaurant configuration details adjusted',
        restaurantId,
      },
    });

    return res.json({ settings: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error updating restaurant configuration' });
  }
};
