# Note de cadrage Décret BACS — EcoVertaConsul't

Version GitHub Pages du pré-diagnostic EcoVerta recentré sur le cadre **Décret BACS**.

## Inclus
- parcours étape par étape
- moteur de calcul recentré sur les leviers BACS / pilotage
- hiérarchisation portefeuille
- note PDF BACS améliorée
- CTA Calendly intégré
- sauvegarde locale
- socle SEO technique

## Configuration
Modifier `assets/app-config.js` pour :
- le lien Calendly
- l'endpoint Formspree
- le titre et la description SEO si besoin

## SEO technique inclus
- balises title / description
- meta robots
- Open Graph / Twitter
- JSON-LD WebApplication
- `robots.txt`
- `sitemap.xml`
- `site.webmanifest`

## Déploiement
Compatible GitHub Pages avec `.nojekyll` et le workflow `.github/workflows/pages.yml`.

## Point de vigilance métier
Le pré-diagnostic aide à prioriser des actions dans le cadre du Décret BACS, mais **ne confirme pas à lui seul l’assujettissement réglementaire**. Celui-ci doit être vérifié à partir des systèmes concernés et de leur puissance nominale utile.


## Hypothèse de production utilisée
Le canonical, le sitemap et le robots pointent vers `https://www.ecovertaconsult.com/pre-diagnostic-decret-bacs/`.
Si tu publies d’abord sous une URL GitHub Pages temporaire, ajuste ces URLs avant ouverture à l’indexation.


## FAQ visible
Une FAQ orientée Décret BACS est intégrée à la page pour améliorer la lisibilité utilisateur, le cadrage des échanges et le balisage SEO FAQPage.
