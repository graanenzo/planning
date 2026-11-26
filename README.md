# Graan & Zo planning

Browser-app voor het personeel van Graan & Zo (afdelingen winkel, restaurant en magazijn), gebouwd op het
Supabase-project `graanenzo-app`. Geen build-stap: het zijn statische bestanden.

## Wat kan de app

**Medewerkers**
- Inloggen met gebruikersnaam en wachtwoord
- Inklokken en uitklokken op de homepagina, en zien wie er vandaag werkt
- Open shifts bekijken en claimen; een aanmelding intrekken zolang die nog niet is beoordeeld
- Beschikbaarheid per dag doorgeven (beschikbaar, deels met tijden, niet beschikbaar)
- Het gepubliceerde rooster bekijken
- Eigen uren bekijken, aanpassen zolang ze niet zijn goedgekeurd, en vergeten uren indienen (14 dagen terug)

**Beheerders**
- Rooster maken per week: shifts toevoegen met aantal plekken, medewerkers rechtstreeks inplannen,
  vorige week kopiëren, publiceren, afdrukken en exporteren naar CSV
- Aanmeldingen op shifts goedkeuren of afkeuren (goedkeuren maakt de dienst aan)
- Beschikbaarheid van het hele team zien
- Urenregistratie: ingeklokte en ingestuurde uren beoordelen, tijden corrigeren, uren toevoegen, alles in één keer goedkeuren

## Hoe het werkt

- Een **shift** is een aantal open plekken op een dag en afdeling. Shifts zijn pas zichtbaar voor medewerkers
  nadat de beheerder het rooster publiceert.
- Een **aanmelding** wordt door een beheerder goedgekeurd. Daarbij wordt een **dienst** aangemaakt (bestaande tabel `diensten`)
  en wordt gecontroleerd op volle shifts en overlap met andere diensten.
- **Kloktijden** (bestaande tabel `kloktijden`) hebben een status: `te_beoordelen`, `goedgekeurd` of `afgekeurd`.
  Goedgekeurde uren zijn vergrendeld voor de medewerker; een aangepaste afgekeurde registratie gaat opnieuw ter beoordeling.
- Alle logica die rechten nodig heeft zit in database-functies (`shift_aanmelden`, `aanmelding_beoordelen`,
  `shift_toewijzen`, `rooster_publiceren`, `uren_beoordelen`, `uren_indienen`, …). Rijen worden afgeschermd met RLS.

## Inloggen

Een gebruikersnaam wordt omgezet naar `medewerker+<gebruikersnaam>@graanenzo.nl`. Een volledig e-mailadres
(bijvoorbeeld voor beheerders) werkt ook.

## Lokaal draaien en hosten

```sh
python3 -m http.server 8080   # daarna http://localhost:8080
```

Hosten kan op Netlify als statische site: publish directory is de hoofdmap, geen build command.
De Supabase URL en publishable key staan in `config.js`. Die mogen openbaar zijn, de beveiliging zit in RLS.

## Structuur

```
index.html  styles.css  config.js  lib.js  app.js
views/  open.js  rooster.js  beschikbaarheid.js  uren.js
```

## Nog niet in de app

Medewerkers aanmaken of afdelingen en rollen wijzigen gaat nu nog via Supabase; de tabel `medewerkers` heeft geen schrijfrechten voor de app.
