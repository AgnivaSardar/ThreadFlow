import { Request, Response } from 'express';
import { UsersService } from './users.service';
import { AppError } from '../../common/errors/AppError';

export class UsersController {
  /**
   * GET /api/v1/users/metadata
   * Metadata (all units and buyers) for dropdowns
   */
  static async getMetadata(_req: Request, res: Response) {
    const data = await UsersService.getMetadata();
    res.status(200).json({ success: true, data });
  }

  /**
   * POST /api/v1/users
   * Creates a new staff member or buyer representative (Admin-only)
   */
  static async createMember(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const member = await UsersService.createMember(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'New member created successfully',
      data: member,
    });
  }

  /**
   * GET /api/v1/users/supervisors
   * Retrieves all supervisors with assigned units and active floor orders
   */
  static async listSupervisors(_req: Request, res: Response) {
    const data = await UsersService.listSupervisors();
    res.status(200).json({ success: true, data });
  }

  /**
   * PATCH /api/v1/users/supervisors/:id
   * Updates supervisor floor work assignment, shift hours, and notes parameters
   */
  static async updateSupervisorAssignment(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    const supervisorId = req.params.id;
    const updated = await UsersService.updateSupervisorAssignment(supervisorId, req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Supervisor floor work assignment updated successfully',
      data: updated,
    });
  }
}
