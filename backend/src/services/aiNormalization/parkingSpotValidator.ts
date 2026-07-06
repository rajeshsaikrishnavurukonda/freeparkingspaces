import { z } from 'zod';

const WeekdaySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'PublicHoliday']);

export const NormalizedRowSchema = z.object({
  index: z.number().int(),
  hasFreeWindow: z.boolean(),
  freeAfter: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  freeBefore: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  freeDays: z.array(WeekdaySchema).nullable(),
  notes: z.string().nullable(),
});

export const NormalizedBatchSchema = z.array(NormalizedRowSchema);

export type NormalizedRow = z.infer<typeof NormalizedRowSchema>;

export function validateNormalizedBatch(raw: unknown): { success: true; data: NormalizedRow[] } | { success: false; error: string } {
  const result = NormalizedBatchSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}

const TimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable();

export const GenericNormalizedRowSchema = z.object({
  index: z.number().int(),
  isParkingLocation: z.boolean(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  hasFreeWindow: z.boolean(),
  freeAfter: TimeSchema,
  freeBefore: TimeSchema,
  freeDays: z.array(WeekdaySchema).nullable(),
  maxStayMinutes: z.number().int().nullable(),
  notes: z.string().nullable(),
});

export const GenericNormalizedBatchSchema = z.array(GenericNormalizedRowSchema);

export type GenericNormalizedRow = z.infer<typeof GenericNormalizedRowSchema>;

export function validateGenericNormalizedBatch(
  raw: unknown,
): { success: true; data: GenericNormalizedRow[] } | { success: false; error: string } {
  const result = GenericNormalizedBatchSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
