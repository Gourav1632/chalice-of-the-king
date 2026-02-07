import { z } from "zod";

const PlayerNameSchema = z.string().trim().min(2).max(20);

export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: PlayerNameSchema,
});

const PasswordSchema = z.string().trim().min(4).max(64);

export const CreateRoomSchema = z
  .object({
    host: PlayerSchema,
    maxPlayer: z.number().int().min(2).max(4),
    isPrivate: z.boolean(),
    password: z.string().trim().max(64).optional(),
    voiceChatEnabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.isPrivate) {
      if (!data.password || !PasswordSchema.safeParse(data.password).success) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: "Password must be 4-64 characters for private rooms.",
        });
      }
    }
  });

export const JoinRoomSchema = z.object({
  roomId: z.string().trim().min(1).max(50),
  player: PlayerSchema,
  password: z.string().trim().max(64).optional(),
});

const ItemTypeSchema = z.enum([
  "royal_scrutiny_glass",
  "verdict_amplifier",
  "crown_disavowal",
  "royal_chain_order",
  "sovereign_potion",
  "chronicle_ledger",
  "paradox_dial",
  "thiefs_tooth",
]);

export const ActionSchema = z
  .object({
    type: z.enum(["drink", "use_item", "steal"]),
    targetPlayerId: z.string().min(1).optional(),
    itemType: ItemTypeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "drink" && !data.targetPlayerId) {
      ctx.addIssue({
        code: "custom",
        path: ["targetPlayerId"],
        message: "Target player is required for drink.",
      });
    }

    if (data.type === "use_item" && !data.itemType) {
      ctx.addIssue({
        code: "custom",
        path: ["itemType"],
        message: "Item type is required for use_item.",
      });
    }

    if (data.type === "steal") {
      if (!data.itemType) {
        ctx.addIssue({
          code: "custom",
          path: ["itemType"],
          message: "Item type is required for steal.",
        });
      }
      if (!data.targetPlayerId) {
        ctx.addIssue({
          code: "custom",
          path: ["targetPlayerId"],
          message: "Target player is required for steal.",
        });
      }
    }
  });
