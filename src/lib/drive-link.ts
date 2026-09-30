// Линк към файл/папка в Drive, който се отваря с училищния акаунт (edu.mon.bg).
// Минава през екрана на Google за избор на акаунт с попълнен имейл:
// ако колегата вече е влязъл с него — отваря директно; ако не — Google иска паролата
// ТОЧНО за този акаунт (а не за личния gmail в браузъра), затова няма „нямате достъп“.
// Без сървърни зависимости — ползва се и в клиента, и на сървъра.
export function googleOpenUrl(url: string, email?: string | null) {
  if (!email) return url
  const target = url + (url.includes('?') ? '&' : '?') + 'authuser=' + encodeURIComponent(email)
  return 'https://accounts.google.com/AccountChooser?Email=' + encodeURIComponent(email)
    + '&continue=' + encodeURIComponent(target)
}
