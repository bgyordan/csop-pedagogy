// ДТВ и оценки: ДТВ за постигнати резултати и други оценки — кампании, карти и „Моите карти“.
// Атестирането е отделен раздел — /attestation.
import EvalPage from './EvalPage'
export const dynamic = 'force-dynamic'

export default async function EvaluationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  return <EvalPage scope="dtv" tab={sp.tab} />
}
