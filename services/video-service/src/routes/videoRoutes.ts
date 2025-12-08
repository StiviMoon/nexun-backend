import { Router, Response } from "express";
import { authenticateToken, AuthenticatedRequest } from "../shared/middleware/authMiddleware";
import { VideoService } from "../services/videoService";

const router = Router();

/**
 * Helper: Send error response
 */
const sendError = (res: Response, status: number, message: string): Response => {
  return res.status(status).json({ success: false, error: message });
};

/**
 * Helper: Send success response
 */
const sendSuccess = <T>(res: Response, data: T): Response => {
  return res.json({ success: true, data });
};

/**
 * GET /api/video/rooms/:roomId
 * Get video room information
 */
router.get(
  "/rooms/:roomId",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const room = await VideoService.getRoom(req.params.roomId);
      if (!room) {
        return sendError(res, 404, "Room not found");
      }
      return sendSuccess(res, room);
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : "Failed to get room");
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
      const participants = await VideoService.getRoomParticipants(req.params.roomId);
      return sendSuccess(res, participants);
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : "Failed to get participants");
    }
  }
);

/**
 * GET /api/video/rooms/:roomId/participants/:userId/screen-sharing
 * Get screen sharing status for a specific participant
 */
router.get(
  "/rooms/:roomId/participants/:userId/screen-sharing",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roomId, userId } = req.params;
      const participant = await VideoService.getParticipant(roomId, userId);

      if (!participant) {
        return sendError(res, 404, "Participant not found");
      }

      return sendSuccess(res, {
        userId: participant.userId,
        isScreenSharing: participant.isScreenSharing || false,
        isVideoEnabled: participant.isVideoEnabled,
        isAudioEnabled: participant.isAudioEnabled
      });
    } catch (error) {
      return sendError(res, 500, error instanceof Error ? error.message : "Failed to get screen sharing status");
    }
  }
);

export default router;

