# n8n-nodes-buchhaltungsbutler

n8n Community Node für die [BuchhaltungsButler API v1](https://app.buchhaltungsbutler.de/docs/api/v1/) (Spec-Stand 1.9.1).
Deckt **alle 58 Endpunkte** ab – Belege, Umsätze, Rechnungen/E-Rechnungen, Buchungen, Debitoren/Kreditoren,
Sachkonten, Basiskonten, Kostenstellen, Kommentare und Auswertungen (BWA, SuSa, Kontenblatt).
`usableAsTool: true` – der Node kann direkt als Tool in AI-Agent-Nodes verwendet werden.

## Installation

**Self-hosted aus der .tgz (ohne npm-Veröffentlichung):**

```bash
# im n8n-Container bzw. auf dem Host
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install /pfad/zu/n8n-nodes-buchhaltungsbutler-0.1.0.tgz
# n8n neu starten
```

Docker-Variante: Volume `~/.n8n` mounten, obigen Befehl im Container ausführen (`docker exec -it n8n sh`), Container neu starten.

**Nach Veröffentlichung auf npm:** Settings → Community Nodes → Install → `n8n-nodes-buchhaltungsbutler`.

## Zugangsdaten

BuchhaltungsButler → Einstellungen → Schnittstellen und API-Zugang:

| Feld | Verwendung |
|---|---|
| API Client | HTTP Basic Auth Benutzername |
| API Secret | HTTP Basic Auth Passwort |
| API Key | Mandant, wird als `api_key` in jeden Request-Body gesetzt |
| Base URL | Standard `https://webapp.buchhaltungsbutler.de/api/v1` |

Der Credential-Test ruft `/accounts/get` auf. Für mehrere Mandanten je Mandant ein Credential anlegen.

## Ressourcen & Operationen

| Ressource | Operationen |
|---|---|
| Receipt (Beleg) | Get Many, Get (inkl. Datei als Binary), Create (ohne Datei), Create Many (Batch), Upload (Binary), Delete, Restore, Get Assigned Transactions |
| Transaction (Umsatz) | Get Many, Get, Create, Create Many (Batch), Delete, Assign Receipt, Unassign Receipt, Assign Receipts (Batch), Get Assigned Receipts |
| Invoice (Rechnung) | Create, Create E-Invoice (ZUGFeRD/XRechnung), Create Draft, Create Correction |
| Posting (Buchung) | Get Many, Add to Receipt, Add to Receipts (Batch), Add to Transaction, Add to Transactions (Batch), Add Free Posting, Add Free Postings (Batch), Unconfirm Receipt/Transaction/Free, Assign Receipt to Free Posting, Cancel |
| Debtor / Creditor | Create, Create Many (Batch), Get Many, Update |
| Posting Account (Sachkonto) | Create, Get Many, Update |
| Account (Basiskonto) | Get Many, Create, Update, Delete |
| Cost Location (Kostenstelle) | Get Many, Create, Update, Delete |
| Comment | Create |
| Report | Create BWA, Create Sums Report, Get BWA, Get Sums Report (Dateien als Binary), Get Ledger |

## Verhalten im Detail

- **Paginierung:** „Return All“ blättert automatisch über `limit`/`offset` (Belege/Umsätze 500, Buchungen/Sachkonten/Kostenstellen 1000 pro Seite).
- **ID-Endpunkte:** Bei Get/Delete/Restore wird das Pfadsegment `id_by_customer` durch die ID ersetzt (`/receipts/get/16`) – so verhält sich die Live-API, die Spec zeigt das nicht korrekt.
- **Upload:** Datei aus einem Binary-Feld, übertragen als Base64 mit `file_name` (offiziell unterstützte Variante).
- **Rechnungspositionen / Buchungszeilen:** Eingabe als Positionsliste im UI, der Node baut daraus die parallelen Arrays (`item_*`, `postingaccounts`, `vats`, `amounts`, …). Bei Umsatzbuchungen wird `oi_receipts_ids_by_customer` immer positionsgleich mit `null` für Zeilen ohne OP-Beleg gesendet.
- **Datumsfelder:** Datepicker oder ISO-Strings werden in `YYYY-MM-DD` bzw. `YYYY-MM-DD HH:MM:SS` umgewandelt.
- **Batch-Operationen:** JSON-Array (max. 50 Einträge bei Belegen, Umsätzen und Zuordnungen, geprüft vor dem Senden).
- **Rate Limits:** Bei mehreren Input-Items hält der Node automatisch Abstand (Upload 6 s, Beleg-/Umsatz-Batch 5 s). HTTP 429 wird bis zu 3× mit Backoff wiederholt.
- **Fehler:** `success: false` bzw. HTTP-Fehler werden mit BuchhaltungsButler-Meldung und `error_code` angezeigt.

## Entwicklung

```bash
npm install --ignore-scripts
npm run build     # n8n-node build
npm run lint      # n8n Community-Node Lint (strict)
npm test          # Offline-Tests gegen gemockte n8n-Laufzeit
npm run dev       # lokale n8n-Instanz mit Hot Reload
```

Die Endpunkte sind deklarativ in `nodes/BuchhaltungsButler/operations.ts` definiert; UI-Parameter und Requests werden daraus generiert. Neue API-Felder ergänzt man dort.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
