import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { StaffRequestType, RequestStatus } from '../types/enums';
import { AuthenticatedRequest } from '../middleware/auth';
import { notifyStaff } from '../socket';

// PUBLIC: Customer requests assistance
export const createRequest = async (req: Request, res: Response) => {
  const { tableId, type } = req.body;

  if (!tableId || !type) {
    return res.status(400).json({ error: 'Table ID and request type are required' });
  }

  try {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { restaurant: true },
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const newRequest = await prisma.staffRequest.create({
      data: {
        tableId,
        type: type as StaffRequestType,
        status: RequestStatus.PENDING,
      },
      include: {
        table: true,
      },
    });

    // Notify staff dashboard in real-time
    notifyStaff(table.restaurantId, 'request:new', newRequest);

    // Create activity log
    await prisma.activityLog.create({
      data: {
        action: 'Waiter Requested',
        details: `Table ${table.number} requested: ${type}`,
        restaurantId: table.restaurantId,
      },
    });

    return res.status(201).json({ request: newRequest });
  } catch (error) {
    console.error('Request creation error:', error);
    return res.status(500).json({ error: 'Server error creating service request' });
  }
};

// STAFF: Get all active requests
export const getRequests = async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized context' });

  try {
    const requests = await prisma.staffRequest.findMany({
      where: {
        table: { restaurantId },
        status: RequestStatus.PENDING,
      },
      include: {
        table: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ error: 'Server error listing service requests' });
  }
};

// STAFF: Resolve request
export const resolveRequest = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const restaurantId = req.user?.restaurantId;

  if (!restaurantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const request = await prisma.staffRequest.findFirst({
      where: {
        id,
        table: { restaurantId },
      },
      include: { table: true },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const updated = await prisma.staffRequest.update({
      where: { id },
      data: { status: RequestStatus.RESOLVED },
    });

    // Notify other staff dashboards to dismiss request
    notifyStaff(restaurantId, 'request:resolve', { id });

    return res.json({ message: 'Request marked as resolved', request: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error resolving request' });
  }
};
