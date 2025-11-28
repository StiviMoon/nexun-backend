import { Router } from "express";
import { authenticateToken, AuthenticatedRequest } from "../shared/middleware/authMiddleware";
import { VideoService } from "../services/videoService";
import { Response } from "express";

const router = Router();

/**
 * GET /api/video/rooms/:roomId
 * Get video room information
 */
router.get(
  "/rooms/:roomId",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roomId } = req.params;
      const room = await VideoService.getRoom(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          error: "Room not found"
        });
      }

      res.json({
        success: true,
        data: room
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get room"
      });
    }
  }
);

/**
 * GET /api/video/rooms/:roomId/participants
 * Get all participants in a video room
 */
router.get(
  "/rooms/:roomId/participants",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roomId } = req.params;
      const participants = await VideoService.getRoomParticipants(roomId);

      res.json({
        success: true,
        data: participants
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get participants"
      });
    }
  }
);

export default router;

