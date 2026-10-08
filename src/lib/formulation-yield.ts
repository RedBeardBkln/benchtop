import { db } from '@/lib/db'
import { formulations, processSteps } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { computeProcessYield, toLossStep } from '@/lib/process-loss'

/**
 * Concentration divisor (% of input weight) for the solver, from the saved
 * process-step losses. `inputWeightG` is the batch the losses are applied to;
 * with none yet (reverse mode), 100 g keeps %-based losses exact.
 */
export async function loadConcentrationYieldPct(
  formulationId: string,
  inputWeightG: number,
  accountId: string,
): Promise<number> {
  // Joined to formulations so steps are only read for a formulation of this account
  const rows = await db
    .select({ step: processSteps })
    .from(processSteps)
    .innerJoin(formulations, eq(processSteps.formulationId, formulations.id))
    .where(and(eq(processSteps.formulationId, formulationId), eq(formulations.accountId, accountId)))
    .orderBy(processSteps.stepNo)
  const steps = rows.map(r => r.step)

  return computeProcessYield(inputWeightG > 0 ? inputWeightG : 100, steps.map(toLossStep)).concentrationYieldPct
}
