import { z } from 'zod';

// Profile update schema
export const UpdateProfileSchema = z.object({
  timezone: z.string().optional(),
  day_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  caffeine_cutoff_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  bedtime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  intense_block_minutes: z.number().int().min(15).max(180).optional(),
  no_intense_within_hours_of_bed: z.number().min(0).max(8).optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
