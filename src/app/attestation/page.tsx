// Атестиране по Наредба № 15/2019: регистър (кой кога подлежи), кампании (атестационна комисия, самооценка,
// портфолио, оценяване, възражения, план за подкрепа), атестационни карти и „Моите карти“.
// Самата кампания се отваря на /evaluation/[id], както и при ДТВ.
import EvalPage from '../evaluation/EvalPage'
export const dynamic = 'force-dynamic'

export default async function AttestationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  return <EvalPage scope="attest" tab={sp.tab} />
}
