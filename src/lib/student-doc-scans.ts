// ТЕЛК/ЛКК и заповедта от РЦПППО се водят на едно място — „Документи със срок“ (student_documents):
// там е срокът, а сканът се пази като файл в student_attachments с този doc_type.
// Затова „Медицинска експертиза“ и „Заповед за насочване“ вече не се качват отделно във „Външни документи“.
export const SCAN_TYPE: Record<string, string> = { telk: 'medical_expertise', rcpppo: 'referral_order' }
export const MERGED_ATTACHMENT_TYPES = Object.values(SCAN_TYPE)
