import { Response } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getActivityLogs = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const logs = await prisma.activityLog.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent 100 entries for performance
    });
    return res.json({ logs });
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing operational activity logs' });
  }
};
