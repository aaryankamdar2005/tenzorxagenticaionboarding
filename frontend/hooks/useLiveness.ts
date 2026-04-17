"use client";

import * as faceapi from "face-api.js";
import { useCallback } from "react";

export type LivenessChallenge = "blink" | "turn_left" | "turn_right" | "smile";

export interface FaceMetrics {
  earLeft: number;
  earRight: number;
  /** Normalised horizontal nose offset: negative = nose left (head right), positive = nose right (head left) */
  yaw: number;
  smiling: boolean;
  faceDetected: boolean;
}

function euclidean(a: faceapi.Point, b: faceapi.Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Eye Aspect Ratio for a 6-point eye array (landmarks 36-41 or 42-47). */
function ear(eye: faceapi.Point[]): number {
  const a = euclidean(eye[1], eye[5]);
  const b = euclidean(eye[2], eye[4]);
  const c = euclidean(eye[0], eye[3]);
  return c < 0.001 ? 1 : (a + b) / (2 * c);
}

export function useLiveness() {
  /**
   * Runs one detection pass on the current video frame.
   * Returns null if no face found or models not loaded.
   */
  const detectMetrics = useCallback(
    async (video: HTMLVideoElement): Promise<FaceMetrics | null> => {
      if (video.readyState < 2) return null;
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (!detection) return null;

        const pts = detection.landmarks.positions;

        const leftEye = pts.slice(36, 42);
        const rightEye = pts.slice(42, 48);
        const noseTip = pts[30];
        const leftOuter = pts[36];
        const rightOuter = pts[45];

        const eyeCenterX = (leftOuter.x + rightOuter.x) / 2;
        const eyeWidth = euclidean(leftOuter, rightOuter);
        const yaw = eyeWidth > 1 ? (noseTip.x - eyeCenterX) / eyeWidth : 0;

        const expressions = detection.expressions as unknown as Record<string, number>;
        const smiling = (expressions.happy ?? 0) > 0.65;

        return {
          earLeft: ear(leftEye),
          earRight: ear(rightEye),
          yaw,
          smiling,
          faceDetected: true,
        };
      } catch {
        return null;
      }
    },
    []
  );

  /**
   * Evaluate whether a given challenge is satisfied by current metrics.
   * Blink: both EARs < 0.21 (eyes closed).
   * Turn right: yaw < -0.18 (nose shifted left in camera space).
   * Turn left:  yaw > +0.18.
   * Smile: smiling flag.
   */
  const isChallengeComplete = useCallback(
    (challenge: LivenessChallenge, metrics: FaceMetrics): boolean => {
      switch (challenge) {
        case "blink":
          return metrics.earLeft < 0.21 && metrics.earRight < 0.21;
        case "turn_right":
          return metrics.yaw < -0.18;
        case "turn_left":
          return metrics.yaw > 0.18;
        case "smile":
          return metrics.smiling;
        default:
          return false;
      }
    },
    []
  );

  return { detectMetrics, isChallengeComplete };
}

export const CHALLENGE_LABELS: Record<LivenessChallenge, string> = {
  blink: "Blink twice slowly",
  turn_right: "Turn your head to the RIGHT",
  turn_left: "Turn your head to the LEFT",
  smile: "Give us a big smile",
};

export const CHALLENGES: LivenessChallenge[] = ["blink", "turn_right", "turn_left", "smile"];

export function pickRandomChallenge(): LivenessChallenge {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}
