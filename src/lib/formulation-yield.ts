import { db } from '@/lib/db'
import { processSteps } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { computeProcessYield, toLossStep } from '@/lib/process-loss'

/**
 * Concentration divisor (% of input weight) for the solver, from the saved
 * process-step losses. `inputWeightG` is the batch the losses are applied to;
 * with none yet (reverse mode), 100 g keeps %-based losses exact.
 */
export async function loadConcentrationYieldPct(formulationId: string, inputWeightG: number): Promise<number> {
  const steps = await db
    .select()
    .from(processSteps)
    .where(eq(processSteps.formulationId, formulationId))
    .orderBy(processSteps.stepNo)

  return computeProcessYield(inputWeightG > 0 ? inputWeightG : 100, steps.map(toLossStep)).concentrationYieldPct
}
