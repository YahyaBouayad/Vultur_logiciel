const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function belowHundred(n) {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (d === 7) return u === 1 ? 'soixante et onze' : 'soixante-' + UNITES[10 + u]
  if (d === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + UNITES[u]
  if (d === 9) return 'quatre-vingt-' + UNITES[10 + u]
  if (u === 0) return DIZAINES[d]
  if (u === 1) return DIZAINES[d] + ' et un'
  return DIZAINES[d] + '-' + UNITES[u]
}

function belowThousand(n) {
  if (n < 100) return belowHundred(n)
  const c = Math.floor(n / 100)
  const rest = n % 100
  const cent = (c === 1 ? '' : UNITES[c] + ' ') + 'cent'
  if (rest === 0) return cent + (c > 1 ? 's' : '')
  return cent + ' ' + belowHundred(rest)
}

function toWords(n) {
  if (n === 0) return 'zéro'
  if (n < 1000) return belowThousand(n)
  if (n < 1000000) {
    const k = Math.floor(n / 1000)
    const rest = n % 1000
    const kStr = k === 1 ? 'mille' : belowThousand(k) + ' mille'
    return rest > 0 ? kStr + ' ' + belowThousand(rest) : kStr
  }
  const m = Math.floor(n / 1000000)
  const rest = n % 1000000
  const mStr = belowThousand(m) + ' million' + (m > 1 ? 's' : '')
  return rest > 0 ? mStr + ' ' + toWords(rest) : mStr
}

export function montantEnLettres(montant) {
  const entier = Math.floor(montant)
  const centimes = Math.round((montant - entier) * 100)
  let result = toWords(entier).toUpperCase() + ' DIRHAMS'
  if (centimes > 0) result += ' ET ' + toWords(centimes).toUpperCase() + ' CENTIMES'
  return result
}
