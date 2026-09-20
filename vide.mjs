/**
 * Bouchon qui remplace @electric-sql/pglite dans le bundle de production.
 *
 * Le Postgres embarque ne sert qu'au developpement, et la branche qui
 * l'utilise disparait deja a la compilation (`import.meta.dev` vaut false).
 * Mais le traceur de Nitro, lui, voit l'`import()` dans les sources et
 * recopiait les 18 Mo du paquet — deux binaires WebAssembly — dans la
 * fonction serverless, qui pese 2,8 Mo sans lui. D'ou cet alias.
 */
export const PGlite = undefined
export const pgcrypto = undefined
export default {}
